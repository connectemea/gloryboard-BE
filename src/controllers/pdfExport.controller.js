import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { EventRegistration } from "../models/eventRegistration.models.js";
import { ApiError } from "../utils/ApiError.js";
import { generateParticipantTickets, generateProgramParticipantsList, generateGroupProgramParticipantsList } from "../services/pdfExport.service.js";
import { getZoneConfig } from "../utils/zoneConfig.js";
import { zone } from "../constants.js";

const sanitizeText = (text) => text.replace(/\t/g, " ");

const getParticipantTickets = asyncHandler(async (req, res, next) => {
  const collegeId = req.user.id;

  // Fetch users from the specified college
  const users = await User.find({ collegeId });
  if (!users || users.length === 0) {
    return next(new ApiError(404, "No users found for the specified college"));
  }

  // Fetch related data from the EventRegistration collection for each user
  const transformedUsers = await Promise.all(
    users.map(async (user) => {
      const eventRegistrations = await EventRegistration.find({
        "participants.user": user._id,
      })
      .populate({
        path: "event",
        populate: {
          path: "event_type",
        },
      });



      if (eventRegistrations.length === 0) {
        return null;
      }

      const userCollege = (await User.findById(user._id).populate("collegeId")).collegeId.name;

      return {
        regId: user.userId,
        name: sanitizeText(user.name).toUpperCase(),
        sex: user.gender.toUpperCase(),
        zone: getZoneConfig(zone).name,
        college: sanitizeText(userCollege),
        course: sanitizeText(user.course),
        dateOfBirth: new Date(user.dob).toLocaleDateString("en-GB"),
        image: user.image,
        semester: user.semester.toString(),
        programs: {
          offStage: eventRegistrations
            .filter((reg) => !reg.event.event_type.is_onstage)
            .map((reg) => sanitizeText(reg.event.name)),
          stage: eventRegistrations
            .filter(
              (reg) =>
                reg.event.event_type.is_onstage &&
                !reg.event.event_type.is_group
            )
            .map((reg) => sanitizeText(reg.event.name)),
          group: eventRegistrations
            .filter((reg) => reg.event.event_type.is_group)
            .map((reg) => sanitizeText(reg.event.name)),
        },
      };
    })
  );

  // Filter out users who don't have any event registrations
  const filteredUsers = transformedUsers.filter((user) => user !== null);

  if (filteredUsers.length === 0) {
    return next(new ApiError(404, "No valid registrations found"));
  }

  const pdfBytes = await generateParticipantTickets(filteredUsers);

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="participant-tickets.pdf"',
  });
  res.send(Buffer.from(pdfBytes));
});

const getParticipantTicketById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findOne({ _id: id });
  if (!user) {
    return next(new ApiError(404, "User not found with the specified regId"));
  }

  const eventRegistrations = await EventRegistration.find({
    "participants.user": user._id,
  }).populate({
    path: "event",
    populate: {
      path: "event_type",
    },
  });

  if (eventRegistrations.length === 0) {
    return next(new ApiError(404, "No registrations found for the user"));
  }

  const userCollege = (await User.findById(user._id).populate("collegeId")).collegeId.name;

  const transformedUser = [
    {
      regId: user.userId,
      name: sanitizeText(user.name).toUpperCase(),
      sex: user.gender.toUpperCase(),
      zone: getZoneConfig(zone).name,
      college: sanitizeText(userCollege),
      course: sanitizeText(user.course),
      dateOfBirth: new Date(user.dob).toLocaleDateString("en-GB"),
      image: user.image,
      semester: user.semester.toString(),
      programs: {
        offStage: eventRegistrations
          .filter((reg) => !reg.event.event_type.is_onstage)
          .map((reg) => sanitizeText(reg.event.name)),
        stage: eventRegistrations
          .filter(
            (reg) =>
              reg.event.event_type.is_onstage && !reg.event.event_type.is_group
          )
          .map((reg) => sanitizeText(reg.event.name)),
        group: eventRegistrations
          .filter((reg) => reg.event.event_type.is_group)
          .map((reg) => sanitizeText(reg.event.name)),
      },
    },
  ];

  const pdfByte = await generateParticipantTickets(transformedUser);

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${user.name}_participant-ticket.pdf"`,
  });
  res.send(Buffer.from(pdfByte));
});

const getProgramParticipantsListById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  
  const eventRegistrations = await EventRegistration.find({
    event: id,
  }).populate("participants.user", "name college").populate({
    path: "event",
    select: "name",
    populate: {
      path: "event_type",
      select: "is_group is_onstage",
    }
  });
  
  if (eventRegistrations.length === 0) {
    return next(new ApiError(404, "No registrations found for the specified event"));
  }

  const eventName = sanitizeText(eventRegistrations[0].event.name);
  const eventTypeObj = eventRegistrations[0].event.event_type;
  const eventType = !eventTypeObj.is_onstage ? "Off Stage" : eventTypeObj.is_group ? "Group" : "Stage";
  
  const participants = eventTypeObj.is_group ? eventRegistrations.map((reg) => ({
    college: sanitizeText(reg.participants[0].user.college),
    participants: reg.participants.map((participant) => sanitizeText(participant.user.name))
  })) :
  eventRegistrations
    .filter(reg => reg.participants[0].user)
    .flatMap((reg) => {
      if (reg.participants.length > 1) {
        return reg.participants.map((participant) => ({
          name: sanitizeText(participant.user?.name),
          college: sanitizeText(participant.user?.college),
        }));
      }
      return {
        name: sanitizeText(reg.participants[0].user?.name),
        college: sanitizeText(reg.participants[0].user?.college),
      };
    });
  
  const data = {
    name: eventName,
    type: eventType,
    participants,
  };

  // const pdfByte = await generateProgramParticipantsList(data);
  const pdfByte = eventTypeObj.is_group ? await generateGroupProgramParticipantsList(data) : await generateProgramParticipantsList(data);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${eventName}-participants-list.pdf"`,
  });
  res.send(Buffer.from(pdfByte));
  // res.json(data);
});

export const pdfExportController = {
  getParticipantTickets,
  getParticipantTicketById,
  getProgramParticipantsListById,
};
