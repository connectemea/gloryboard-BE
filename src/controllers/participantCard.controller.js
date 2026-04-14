import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { EventRegistration } from "../models/eventRegistration.models.js";
import { ApiError } from "../utils/ApiError.js";
import { generateParticipantCards, generateParticipantCardsCompact } from "../services/participantCard.service.js";

const sanitizeText = (text) => text.replace(/\t/g, " ").trim();

/**
 * Helper function to fetch and transform participant card data for a college
 * @param {string} collegeId - The college ID to fetch users for
 * @returns {Promise<{users: Array, error: {status: number, message: string} | null}>}
 */
const fetchParticipansData = async (collegeId) => {
    // Fetch users from the specified college
    const users = await User.find({ collegeId });
    if (!users || users.length === 0) {
        return { users: null, error: { status: 404, message: "No users found for the specified college" } };
    }

    // Fetch related data from the EventRegistration collection for each user
    const transformedUsers = await Promise.all(
        users.map(async (user) => {
            const eventRegistrations = await EventRegistration.find({
                "participants.user": user._id,
            })
                .populate({
                    path: "event",
                    select: "name"
                });

            if (eventRegistrations.length === 0) {
                return null;
            }

            const userCollege = (await User.findById(user._id).populate("collegeId")).collegeId.name;

            return {
                regId: user.userId,
                name: sanitizeText(user.name).toUpperCase(),
                college: sanitizeText(userCollege),
                image: user.image,
                programs: eventRegistrations.map((reg) => sanitizeText(reg.event.name)),
            };
        })
    );

    // Filter out users who don't have any event registrations
    const filteredUsers = transformedUsers.filter((user) => user !== null);

    if (filteredUsers.length === 0) {
        return { users: null, error: { status: 404, message: "No valid registrations found" } };
    }

    return { users: filteredUsers, error: null };
};

/**
 * Helper function to fetch and transform participant card data for ALL colleges
 * @returns {Promise<{users: Array, error: {status: number, message: string} | null}>}
 */
const fetchAllParticipantsData = async () => {
    // Query 1: Fetch all users with their college populated in a single query
    const users = await User.find({}).populate("collegeId", "name");
    if (!users || users.length === 0) {
        return { users: null, error: { status: 404, message: "No users found" } };
    }

    // Build a userId -> user map for fast lookup
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // Query 2: Fetch ALL event registrations that involve any of these users, in one query
    const allRegistrations = await EventRegistration.find({
        "participants.user": { $in: users.map((u) => u._id) },
    }).populate({ path: "event", select: "name" });

    // Group registrations by user ID (a single user can appear in multiple registrations)
    const registrationsByUser = new Map();
    for (const reg of allRegistrations) {
        for (const participant of reg.participants) {
            const uid = participant.user.toString();
            if (userMap.has(uid)) {
                if (!registrationsByUser.has(uid)) {
                    registrationsByUser.set(uid, []);
                }
                registrationsByUser.get(uid).push(reg);
            }
        }
    }

    // Transform in-memory — no further DB calls needed
    const transformedUsers = users
        .map((user) => {
            const regs = registrationsByUser.get(user._id.toString());
            if (!regs || regs.length === 0) return null;

            const collegeName = user.collegeId?.name || "Unknown";

            return {
                regId: user.userId,
                name: sanitizeText(user.name).toUpperCase(),
                college: sanitizeText(collegeName),
                image: user.image,
                programs: regs.map((reg) => sanitizeText(reg.event.name)),
            };
        })
        .filter(Boolean);

    if (transformedUsers.length === 0) {
        return { users: null, error: { status: 404, message: "No valid registrations found" } };
    }

    // Sort users by college name to group participants from the same college together
    const sortedUsers = transformedUsers.sort((a, b) => a.college.localeCompare(b.college));

    return { users: sortedUsers, error: null };
};

const getParticipantCards = asyncHandler(async (req, res, next) => {
    const collegeId = req.params?.id || req.user?.id;

    const { users, error } = await fetchParticipansData(collegeId);
    if (error) {
        return next(new ApiError(error.status, error.message));
    }

    const pdfBytes = await generateParticipantCards(users);

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${users[0]?.college}-participant-cards-A6.pdf"`,
    });
    res.send(Buffer.from(pdfBytes));
});

const getParticipantCardsCompact = asyncHandler(async (req, res, next) => {
    const collegeId = req.params?.id || req.user?.id;

    const { users, error } = await fetchParticipansData(collegeId);
    if (error) {
        return next(new ApiError(error.status, error.message));
    }

    const pdfBytes = await generateParticipantCardsCompact(users);

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${users[0]?.college}-participant-cards.pdf"`,
    });
    res.send(Buffer.from(pdfBytes));
});

const getParticipantCardById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const user = await User.findOne({ _id: id });
    if (!user) {
        return next(new ApiError(404, "User not found with the specified regId"));
    }

    const eventRegistrations = await EventRegistration.find({
        "participants.user": user._id,
    }).populate({
        path: "event",
        select: "name"
    });

    if (eventRegistrations.length === 0) {
        return next(new ApiError(404, "No registrations found for the user"));
    }

    const userCollege = (await User.findById(user._id).populate("collegeId")).collegeId.name;

    const transformedUser = [
        {
            regId: user.userId,
            name: sanitizeText(user.name).toUpperCase(),
            college: sanitizeText(userCollege),
            image: user.image,
            programs: eventRegistrations.map((reg) => sanitizeText(reg.event.name)),
        },
    ];

    const pdfByte = await generateParticipantCards(transformedUser);

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${user.name}_participant-card.pdf"`,
    });
    res.send(Buffer.from(pdfByte));
});

/**
 * Admin route: Get all participant cards for all colleges in compact A3 format
 */
const getAllParticipantCardsCompact = asyncHandler(async (req, res, next) => {
    const { users, error } = await fetchAllParticipantsData();
    if (error) {
        return next(new ApiError(error.status, error.message));
    }

    const pdfBytes = await generateParticipantCardsCompact(users);

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="all-participant-cards-A3.pdf"',
    });
    res.send(Buffer.from(pdfBytes));
});

export const participantCardController = {
    getParticipantCards,
    getParticipantCardsCompact,
    getParticipantCardById,
    getAllParticipantCardsCompact,
};
