import mongoose from "mongoose";
import { Result } from "../models/result.models.js";
import { ApiError } from "../utils/ApiError.js";
import { Event } from "../models/event.models.js";
import { EventRegistration } from "../models/eventRegistration.models.js";
import { EventType } from "../models/eventType.models.js";
import { DEPARTMENTS, POSITIONS, RESULT_CATEGORIES } from "../constants.js";
import { User } from "../models/user.models.js";
import { Counter } from "../models/counter.model.js";
import { Leaderboard } from "../models/leaderboard.model.js";

const fetchAllResults = async () => {
  try {
    // Fetch all results, exclude specific fields from the result document and populated collections
    const results = await Result.find()
      .select("-created_at -updated_at -created_by -updated_by -__v") // Exclude from result document
      .populate({
        path: "event",
        select: "-created_at -updated_at -created_by -updated_by -__v", // Exclude from Event document
        populate: {
          path: "event_type",
          model: "EventType",
          select:
            "-scores -created_at -updated_at -created_by -updated_by -__v ", // Exclude from EventType document
        },
      })
      .populate({
        path: "winningRegistrations.eventRegistration",
        select: "-created_at -updated_at -created_by -updated_by -__v", // Exclude from EventRegistration document
        populate: [
          {
            path: "participants",
            populate: {
              path: "user",
              model: "User",
              select: "-created_at -updated_at -created_by -updated_by -__v", // Exclude from User document
            },
          },
        ],
      })
      .populate("updated_by", "name") // Exclude specific fields from the updated_by user document
      .exec();

    return results;
  } catch (error) {
    throw new Error(error.message);
  }
};

const fetchResultByEventId = async (event_id) => {
  const aggregate = [
    // Step 1: Match specific event ID
    {
      $match: {
        event: mongoose.Types.ObjectId.createFromHexString(event_id),
      },
    },
    // Step 2: Lookup event details only once and project necessary fields early
    {
      $lookup: {
        from: "events",
        localField: "event",
        foreignField: "_id",
        as: "event",
      },
    },
    {
      $unwind: {
        path: "$event",
      },
    },
    // Step 3: Lookup event type to fetch is_onstage
    {
      $lookup: {
        from: "eventtypes", // Replace with the actual name of your event type collection
        localField: "event.event_type",
        foreignField: "_id",
        as: "event.event_type_details",
      },
    },
    {
      $unwind: {
        path: "$event.event_type_details",
        preserveNullAndEmptyArrays: true,
      },
    },
    // Step 4: Reduce document size by excluding unnecessary fields early
    {
      $project: {
        "event.created_at": 0,
        "event.updated_at": 0,
        "event.__v": 0,
        "event.event_type_details.created_at": 0,
        "event.event_type_details.updated_at": 0,
        "event.event_type_details.__v": 0,
      },
    },
    // Step 5: Unwind the winningRegistrations array
    {
      $unwind: {
        path: "$winningRegistrations",
      },
    },
    // Step 6: Lookup event registrations once
    {
      $lookup: {
        from: "eventregistrations",
        localField: "winningRegistrations.eventRegistration",
        foreignField: "_id",
        as: "winningRegistrations.eventRegistration",
      },
    },
    {
      $unwind: {
        path: "$winningRegistrations.eventRegistration",
        preserveNullAndEmptyArrays: true,
      },
    },
    // Step 7: Lookup user details once for participants and helpers
    {
      $lookup: {
        from: "users",
        localField: "winningRegistrations.eventRegistration.participants.user",
        foreignField: "_id",
        as: "winningRegistrations.eventRegistration.participants.user",
      },
    },
    // Step 8: Lookup college details for any user in the event registration
    {
      $lookup: {
        from: "admins",
        localField:
          "winningRegistrations.eventRegistration.participants.user.collegeId",
        foreignField: "_id",
        as: "collegeDetails",
      },
    },
    {
      $unwind: {
        path: "$collegeDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    // Step 9: Project only necessary fields and exclude unnecessary fields
    {
      $project: {
        "winningRegistrations.eventRegistration.participants.user.user_type": 0,
        "winningRegistrations.eventRegistration.participants.user.created_at": 0,
        "winningRegistrations.eventRegistration.participants.user.updated_at": 0,
        "winningRegistrations.eventRegistration.participants.user.__v": 0,
        "winningRegistrations.eventRegistration.created_at": 0,
        "winningRegistrations.eventRegistration.updated_at": 0,
        "winningRegistrations.eventRegistration.__v": 0,
        "winningRegistrations.eventRegistration.event": 0,
        "collegeDetails.created_at": 0,
        "collegeDetails.updated_at": 0,
        "collegeDetails.__v": 0,
      },
    },
    // Step 10: Add collegeName to eventRegistration
    {
      $addFields: {
        "winningRegistrations.eventRegistration.collegeName":
          "$collegeDetails.name",
      },
    },
    // Step 11: Group by event and aggregate the winning registrations
    {
      $group: {
        _id: "$event._id",
        serial_number: { $first: "$serial_number" },
        name: { $first: "$event.name" },
        is_onstage: { $first: "$event.event_type_details.is_onstage" },
        is_group: { $first: "$event.event_type_details.is_group" },
        winningRegistrations: { $push: "$winningRegistrations" },
        updated_at: { $first: "$updatedAt" },
      },
    },
    // Step 12: Final projection to ensure clean output
    {
      $project: {
        updated_at: 1,
        serial_number: 1,
        "winningRegistrations._id": 1,
        "winningRegistrations.position": 1,
        "winningRegistrations.eventRegistration": 1,
        name: 1,
        is_onstage: 1,
        is_group: 1,
      },
    },
  ];

  const result = await Result.aggregate(aggregate);

  return result;
};

const createResult = async (event_id, winningRegistrations, user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const event = await Event.findById(event_id).session(session);

    if (!event) {
      throw new Error("Event not found");
    }

    // if result for event already exists, throw an error
    const existingResult = await Result.findOne({ event: event_id }).session(
      session
    );

    if (existingResult) {
      throw new Error("Result already exists for this event");
    }

    const eventType = await EventType.findById(event.event_type).session(
      session
    );

    if (!eventType) {
      throw new Error("Event type not found");
    }

    const isGroupEvent = eventType.is_group;

    for (const registration of winningRegistrations) {
      const eventRegistration = await EventRegistration.findById(
        registration.eventRegistration
      ).session(session);

      if (!eventRegistration) {
        throw new Error("Event registration not found");
      }

      const positionScore = eventType.scores[POSITIONS[registration.position]];

      if (!positionScore) {
        throw new Error("Invalid position provided");
      }

      eventRegistration.score = positionScore;

      if (!isGroupEvent) {
        for (const participant of eventRegistration.participants) {
          const user = await User.findById(participant.user).session(session);

          if (!user) {
            throw new Error("User not found");
          }

          user.total_score += positionScore;

          await user.save({ session });
        }
      }

      await eventRegistration.save({ session });
    }

    const result = new Result({
      event: event_id,
      winningRegistrations,
      created_by: user,
      updated_by: user,
    });

    await result.save({ session });
    await session.commitTransaction();
    console.log("Transaction committed");

    // Trigger leaderboard recalculation
    await updateLeaderboardData();

    return result;
  } catch (error) {
    await session.abortTransaction();
    console.log("Transaction aborted");
    console.error("transaction error", error);
    throw new Error(error.message);
  } finally {
    session.endSession();
  }
};

const deleteResult = async (resultId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Fetch the result document
    if (!resultId) throw new Error("Result ID is required");
    const result = await Result.findById(resultId).session(session);
    if (!result) throw new Error(`Result not found for ID: ${resultId}`);
    const event = await Event.findById(result.event).session(session);
    if (!event) throw new Error(`Event not found for ID: ${result.event}`);
    const eventType = await EventType.findById(event.event_type).session(
      session
    );
    if (!eventType)
      throw new Error(`Event type not found for ID: ${event.event_type}`);
    const isGroupEvent = eventType.is_group;
    // Revert participant and user scores for non-group events
    for (const registration of result.winningRegistrations) {
      const eventRegistration = await EventRegistration.findById(
        registration.eventRegistration
      ).session(session);
      if (!eventRegistration) {
        throw new Error(
          `Event registration not found for ID: ${registration.eventRegistration}`
        );
      }
      const positionScore = eventType.scores[POSITIONS[registration.position]];
      if (!positionScore) {
        throw new Error(`Invalid position: ${registration.position}`);
      }

      eventRegistration.score -= positionScore; // Update the score field

      if (!isGroupEvent) {
        // Reverse score updates for each participant
        for (const participant of eventRegistration.participants) {
          const user = await User.findById(participant.user).session(session);
          if (!user) {
            throw new Error(`User not found for ID: ${participant.user}`);
          }
          user.total_score -= positionScore;
          await user.save({ session });
        }
      }
      // Save reverted event registration changes
      await eventRegistration.save({ session });
    }
    // Delete the result document
    await Result.findByIdAndDelete(resultId).session(session);
    // Commit the transaction
    await session.commitTransaction();
    console.log("Transaction committed successfully");

    // Trigger leaderboard recalculation
    await updateLeaderboardData();

    return true;
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();
    console.error("Transaction aborted due to error:", error.message);
    throw new Error(error.message);
  } finally {
    session.endSession();
  }
};

const updateResult = async (resultId, updatedWinningRegistrations, user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await Result.findById(resultId).session(session);
    if (!result) {
      throw new Error("Result not found");
    }

    const event = await Event.findById(result.event).session(session);
    if (!event) {
      throw new Error("Event not found");
    }

    const eventType = await EventType.findById(event.event_type).session(
      session
    );
    if (!eventType) {
      throw new Error("Event type not found");
    }

    const isGroupEvent = eventType.is_group;

    // Revert scores for existing winning registrations
    for (const registration of result.winningRegistrations) {
      const eventRegistration = await EventRegistration.findById(
        registration.eventRegistration
      ).session(session);
      if (!eventRegistration) {
        throw new Error("Event registration not found");
      }

      const positionScore = eventType.scores[POSITIONS[registration.position]];
      if (!positionScore) {
        throw new Error("Invalid position provided");
      }

      eventRegistration.score -= positionScore;

      if (!isGroupEvent) {
        for (const participant of eventRegistration.participants) {
          const user = await User.findById(participant.user).session(session);
          if (!user) {
            throw new Error("User not found");
          }

          user.total_score -= positionScore;
          await user.save({ session });
        }
      }

      await eventRegistration.save({ session });
    }

    // Apply new scores for updated winning registrations
    for (const registration of updatedWinningRegistrations) {
      const eventRegistration = await EventRegistration.findById(
        registration.eventRegistration
      ).session(session);
      if (!eventRegistration) {
        throw new Error("Event registration not found");
      }

      const positionScore = eventType.scores[POSITIONS[registration.position]];
      if (!positionScore) {
        throw new Error("Invalid position provided");
      }

      eventRegistration.score = positionScore;

      if (!isGroupEvent) {
        for (const participant of eventRegistration.participants) {
          const user = await User.findById(participant.user).session(session);
          if (!user) {
            throw new Error("User not found");
          }

          user.total_score += positionScore;
          await user.save({ session });
        }
      }

      await eventRegistration.save({ session });
    }

    result.winningRegistrations = updatedWinningRegistrations;
    result.updated_by = user;
    await result.save({ session });

    await session.commitTransaction();
    console.log("Transaction committed");

    // Trigger leaderboard recalculation
    await updateLeaderboardData();

    return result;
  } catch (error) {
    await session.abortTransaction();
    console.log("Transaction aborted");
    console.error("transaction error", error);
    throw new Error(error.message);
  } finally {
    session.endSession();
  }
};

const fetchAllIndividualResults = async () => {
  const aggregate = [
    {
      $lookup: {
        from: "events",
        localField: "event",
        foreignField: "_id",
        as: "eventDetails",
      },
    },
    {
      $unwind: {
        path: "$eventDetails",
      },
    },
    {
      $lookup: {
        from: "eventtypes",
        localField: "eventDetails.event_type",
        foreignField: "_id",
        as: "eventTypeDetails",
      },
    },
    {
      $unwind: {
        path: "$eventTypeDetails",
      },
    },
    {
      $match: {
        "eventTypeDetails.is_group": false,
      },
    },
    {
      $lookup: {
        from: "eventregistrations",
        localField: "winningRegistrations.eventRegistration",
        foreignField: "_id",
        as: "winningRegistrationDetails",
      },
    },
    {
      $unwind: {
        path: "$winningRegistrationDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "winningRegistrationDetails.participants.user",
        foreignField: "_id",
        as: "participantDetails",
      },
    },
    {
      $group: {
        _id: "$event",
        eventDetails: { $first: "$eventDetails" },
        eventTypeDetails: {
          $first: "$eventTypeDetails",
        },
        winningRegistrations: {
          $push: {
            registrations: "$winningRegistrationDetails",
            participants: "$participantDetails",
            position: {
              $arrayElemAt: ["$winningRegistrations.position", 0],
            },
          },
        },
      },
    },
    {
      $addFields: {
        name: "$eventDetails.name",
        eventType: "$eventTypeDetails.name",
        type: "$eventTypeDetails.type",
        isGroup: "$eventTypeDetails.is_group",
      },
    },
    {
      $project: {
        _id: 0,
        eventDetails: 0,
        eventTypeDetails: 0,
      },
    },
  ];

  const results = await Result.aggregate(aggregate);

  return results;
};

const updateLeaderboardData = async () => {
  try {
    const lastCount = await Counter.findOne({ _id: "result" });
    const totalResultCount = await Result.countDocuments();

    const collegeResults = await Result.aggregate([
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventDetails",
        },
      },
      { $unwind: "$eventDetails" },
      {
        $lookup: {
          from: "eventtypes",
          localField: "eventDetails.event_type",
          foreignField: "_id",
          as: "eventTypeDetails",
        },
      },
      { $unwind: "$eventTypeDetails" },
      { $unwind: "$winningRegistrations" },
      {
        $lookup: {
          from: "eventregistrations",
          localField: "winningRegistrations.eventRegistration",
          foreignField: "_id",
          as: "registrationDetails",
        },
      },
      { $unwind: "$registrationDetails" },
      {
        $lookup: {
          from: "users",
          localField: "registrationDetails.participants.user",
          foreignField: "_id",
          as: "participantDetails",
        },
      },
      {
        $lookup: {
          from: "admins",
          localField: "participantDetails.collegeId",
          foreignField: "_id",
          as: "collegeDetails",
        },
      },
      { $unwind: "$collegeDetails" },
      {
        $group: {
          _id: "$collegeDetails._id",
          collegeName: { $first: "$collegeDetails.name" },
          totalScore: { $sum: "$registrationDetails.score" }, // Sum scores only once per registration
        },
      },
      { $sort: { totalScore: -1 } },
    ]);

    // Get top scorers by result_category
    const categoryTopScorers = await Result.aggregate([
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventDetails",
        },
      },
      {
        $unwind: "$eventDetails",
      },
      {
        $match: {
          "eventDetails.result_category": {
            $in: ["saahithyolsavam", "chithrolsavam"],
          },
        },
      },
      {
        $unwind: "$winningRegistrations",
      },
      {
        $lookup: {
          from: "eventregistrations",
          localField: "winningRegistrations.eventRegistration",
          foreignField: "_id",
          as: "eventRegistrationDetails",
        },
      },
      {
        $unwind: "$eventRegistrationDetails",
      },
      {
        $unwind: "$eventRegistrationDetails.participants",
      },
      {
        $lookup: {
          from: "users",
          localField: "eventRegistrationDetails.participants.user",
          foreignField: "_id",
          as: "participantDetails",
        },
      },
      { $unwind: "$participantDetails" },
      {
        $lookup: {
          from: "admins",
          localField: "participantDetails.collegeId",
          foreignField: "_id",
          as: "participantDetails.college",
        },
      },
      {
        $unwind: "$participantDetails.college",
      },
      {
        $group: {
          _id: {
            category: "$eventDetails.result_category",
            user: "$participantDetails._id",
          },
          category: {
            $first: "$eventDetails.result_category",
          },
          userName: {
            $first: "$participantDetails.name",
          },
          image: {
            $first: "$participantDetails.image",
          },
          college: {
            $first: "$participantDetails.college",
          },
          totalScore: {
            $sum: "$eventRegistrationDetails.score",
          },
        },
      },
      {
        $sort: {
          category: 1,
          totalScore: -1,
        },
      },
      {
        $group: {
          _id: "$category",
          topScorers: {
            $push: {
              name: "$userName",
              score: "$totalScore",
              image: "$image",
              college: "$college.name",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          topScorers: {
            $slice: ["$topScorers", 10],
          },
        },
      },
    ]);

    // Get top scorers by gender
    const genderTopScorers = await Result.aggregate([
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventDetails",
        },
      },
      { $unwind: "$eventDetails" },
      {
        $lookup: {
          from: "eventtypes",
          localField: "eventDetails.event_type",
          foreignField: "_id",
          as: "eventTypeDetails",
        },
      },
      { $unwind: "$eventTypeDetails" },
      {
        $match: {
          "eventTypeDetails.is_onstage": true,
          "eventTypeDetails.is_group": false,
        },
      },
      { $unwind: "$winningRegistrations" },
      {
        $lookup: {
          from: "eventregistrations",
          localField: "winningRegistrations.eventRegistration",
          foreignField: "_id",
          as: "eventRegistrationDetails",
        },
      },
      { $unwind: "$eventRegistrationDetails" },
      { $unwind: "$eventRegistrationDetails.participants" },
      {
        $lookup: {
          from: "users",
          localField: "eventRegistrationDetails.participants.user",
          foreignField: "_id",
          as: "participantDetails",
        },
      },
      { $unwind: "$participantDetails" },
      {
        $match: {
          "participantDetails.gender": { $in: ["male", "female"] },
        },
      },
      {
        $group: {
          _id: {
            gender: "$participantDetails.gender",
            user: "$participantDetails._id",
          },
          gender: { $first: "$participantDetails.gender" },
          userName: { $first: "$participantDetails.name" },
          image: { $first: "$participantDetails.image" },
          college: { $first: "$participantDetails.college" },
          totalScore: { $sum: "$eventRegistrationDetails.score" },
        },
      },
      {
        $sort: {
          gender: 1,
          totalScore: -1,
        },
      },
      {
        $group: {
          _id: "$gender",
          topScorers: {
            $push: {
              name: "$userName",
              score: "$totalScore",
              image: "$image",
              college: "$college",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          gender: "$_id",
          topScorers: { $slice: ["$topScorers", 10] },
        },
      },
    ]);

    const newLeaderboard = new Leaderboard({
      totalResultCount,
      lastCount: lastCount.seq,
      results: collegeResults,
      categoryTopScorers,
      genderTopScorers,
    });

    await newLeaderboard.save();

    return newLeaderboard;
  } catch (error) {
    console.error(error.message);
    throw new ApiError(500, "Failed to fetch leaderboard data");
  }
};

const fetchLeaderboardData = async () => {
  try {
    const leaderboard = await Leaderboard.findOne().sort({ createdAt: -1 });

    if (!leaderboard) {
      throw new ApiError(404, "Leaderboard data not found");
    }

    return leaderboard;
  } catch (error) {
    console.error(error.message);
    throw new ApiError(500, "Failed to fetch leaderboard data");
  }
};

const fetchResultsGroupedByCollege = async () => {
  const aggregate = [
    {
      $lookup: {
        from: "events",
        localField: "event",
        foreignField: "_id",
        as: "eventDetails",
      },
    },
    { $unwind: "$eventDetails" },
    { $unwind: "$winningRegistrations" },
    {
      $lookup: {
        from: "eventregistrations",
        localField: "winningRegistrations.eventRegistration",
        foreignField: "_id",
        as: "eventRegistrationDetails",
      },
    },
    { $unwind: "$eventRegistrationDetails" },
    {
      $lookup: {
        from: "users",
        localField: "eventRegistrationDetails.participants.user",
        foreignField: "_id",
        as: "participantDetails",
      },
    },
    {
      $lookup: {
        from: "admins",
        localField: "participantDetails.collegeId",
        foreignField: "_id",
        as: "collegeDetails",
      },
    },
    { $unwind: "$collegeDetails" },
    {
      $group: {
        _id: "$collegeDetails._id",
        college: { $first: "$collegeDetails.name" },
        totalScore: { $sum: "$eventRegistrationDetails.score" },
        events: {
          $push: {
            event: "$eventDetails.name",
            position: "$winningRegistrations.position",
            score: "$eventRegistrationDetails.score",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        college: 1,
        totalScore: 1,
        events: 1,
      },
    },
    {
      $sort: {
        totalScore: -1,
      },
    },
  ];

  const results = await Result.aggregate(aggregate);
  return results;
};

const fetchResultsByCollegeId = async (collegeId) => {
  const aggregate = [
    {
      $lookup: {
        from: "events",
        localField: "event",
        foreignField: "_id",
        as: "eventDetails",
      },
    },
    { $unwind: "$eventDetails" },
    { $unwind: "$winningRegistrations" },
    {
      $lookup: {
        from: "eventregistrations",
        localField: "winningRegistrations.eventRegistration",
        foreignField: "_id",
        as: "eventRegistrationDetails",
      },
    },
    { $unwind: "$eventRegistrationDetails" },
    {
      $lookup: {
        from: "users",
        localField: "eventRegistrationDetails.participants.user",
        foreignField: "_id",
        as: "participantDetails",
      },
    },
    {
      $lookup: {
        from: "admins",
        localField: "participantDetails.collegeId",
        foreignField: "_id",
        as: "collegeDetails",
      },
    },
    { $unwind: "$collegeDetails" },
    {
      $match: {
        "collegeDetails._id": mongoose.Types.ObjectId(collegeId),
      },
    },
    {
      $group: {
        _id: "$collegeDetails._id",
        college: { $first: "$collegeDetails.name" },
        totalScore: { $sum: "$eventRegistrationDetails.score" },
        events: {
          $push: {
            event: "$eventDetails.name",
            position: "$winningRegistrations.position",
            score: "$eventRegistrationDetails.score",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        college: 1,
        totalScore: 1,
        events: 1,
      },
    },
    {
      $sort: {
        totalScore: -1,
      },
    },
  ];

  const results = await Result.aggregate(aggregate);
  return results;
};

const fetchDetailedGenderTopperResults = async () => {
  try {
    const aggregate = [
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventDetails",
        },
      },
      { $unwind: "$eventDetails" },
      {
        $lookup: {
          from: "eventtypes",
          localField: "eventDetails.event_type",
          foreignField: "_id",
          as: "eventTypeDetails",
        },
      },
      { $unwind: "$eventTypeDetails" },
      {
        $match: {
          "eventTypeDetails.is_onstage": true,
          "eventTypeDetails.is_group": false,
        },
      },
      { $unwind: "$winningRegistrations" },
      {
        $lookup: {
          from: "eventregistrations",
          localField: "winningRegistrations.eventRegistration",
          foreignField: "_id",
          as: "eventRegistrationDetails",
        },
      },
      { $unwind: "$eventRegistrationDetails" },
      { $unwind: "$eventRegistrationDetails.participants" },
      {
        $lookup: {
          from: "users",
          localField: "eventRegistrationDetails.participants.user",
          foreignField: "_id",
          as: "participantDetails",
        },
      },
      { $unwind: "$participantDetails" },
      {
        $match: {
          "participantDetails.gender": { $in: ["male", "female"] },
        },
      },
      {
        $group: {
          _id: {
            gender: "$participantDetails.gender",
            user: "$participantDetails._id",
          },
          gender: { $first: "$participantDetails.gender" },
          userName: { $first: "$participantDetails.name" },
          image: { $first: "$participantDetails.image" },
          college: { $first: "$participantDetails.college" },
          totalScore: { $sum: "$eventRegistrationDetails.score" },
          events: {
            $push: {
              name: "$eventDetails.name",
              position: "$winningRegistrations.position",
            },
          },
        },
      },
      {
        $sort: {
          gender: 1,
          totalScore: -1,
        },
      },
      {
        $group: {
          _id: "$gender",
          topScorers: {
            $push: {
              name: "$userName",
              score: "$totalScore",
              image: "$image",
              college: "$college",
              events: "$events",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          gender: "$_id",
          topScorers: { $slice: ["$topScorers", 10] },
        },
      },
    ];

    const results = await Result.aggregate(aggregate);

    return results;
  } catch (error) {
    console.error(error.message);
    throw new Error("Failed to fetch detailed result");
  }
};

export const resultServices = {
  fetchAllResults,
  fetchResultByEventId,
  createResult,
  updateResult,
  deleteResult,
  fetchAllIndividualResults,
  updateLeaderboardData,
  fetchLeaderboardData,
  fetchResultsGroupedByCollege,
  fetchResultsByCollegeId,
  fetchDetailedGenderTopperResults,
};
