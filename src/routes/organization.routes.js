import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { userController } from "../controllers/user.controller.js";
import { verifyJWT, verifyRole } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middleware.js";
import { eventRegistrationController } from "../controllers/eventRegistration.controller.js";
import { pdfExportController } from "../controllers/pdfExport.controller.js";
import { participantCardController } from "../controllers/participantCard.controller.js";
import { appConfigController } from "../controllers/appConfig.controller.js";
import { eventController } from "../controllers/event.controller.js";
const router = Router();

router.use(verifyJWT, verifyRole(["admin", "organization"]));


router.route("/register").post(upload.single('image'), userController.registerUser);
router.route("/update/:id").put(upload.single('image'), userController.updateUser);
router.route("/me").get(authController.getCurrentUser);
router.route("/delete/:id").delete(userController.deleteUserById);
router.route("/users").get(userController.fetchUsers);

// event registration routes
router.route("/event-registration").get(eventRegistrationController.getAllEventRegistrations);
router.route("/event-registration").post(eventRegistrationController.createEventRegistration);
router.route("/event-registration/:id").get(eventRegistrationController.getEventRegistrationById);
router.route("/event-registration/event/:id").get(eventRegistrationController.getEventRegistrationByEventId);
router.route("/event-registration/update/:id").patch(eventRegistrationController.updateEventRegistration);
router.route("/event-registration/delete/:id").delete(eventRegistrationController.deleteEventRegistration);

// Event routes
router.route("/events").get(eventController.fetchAllEvents);


// PDF export routes
router.route("/participant-tickets").get(pdfExportController.getParticipantTickets);
router.route("/ticket/:id").get(pdfExportController.getParticipantTicketById);
router.route("/participant-cards").get(participantCardController.getParticipantCards);
router.route("/participant-card/:id").get(participantCardController.getParticipantCardById);
router.route("/participant-cards-compact").get(participantCardController.getParticipantCardsCompact);


// configs 
router.route("/config").get(appConfigController.getConfigs);

export default router;
