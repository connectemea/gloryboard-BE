import { rgb } from 'pdf-lib';
export const getZoneConfig = (zone) => {
  console.log("zone", zone);
    switch (zone?.toLowerCase()) {
      case 'a':
        return {
          name:"A zone",
          primaryColor: rgb(0.69, 0.18, 0.51), 
          headerImagePath: './src/templates/zone_a_participant_ticket_header.png',
          participantCardImagePath: './src/templates/zone_c_participant_card.png',
          participantCardColor: rgb(0.353, 0.231, 0.102),
          footerText: ["Kindly submit the A-zone copy along with the following documents to the Program Office on or before 20th January.", "A copy of your SSLC Book.", "A copy of your Hall Ticket."],
          DB_NAME: "A-Zone",
          idPrefix: "KRT",
        };
      case 'c':
        return {
          name:"C zone",
          primaryColor: rgb(0.08, 0.13, 0.38),
          headerImagePath: './src/templates/zone_c_participant_ticket_header.png',
          participantCardImagePath: './src/templates/zone_c_participant_card.png',
          participantCardColor: rgb(0.353, 0.231, 0.102),
          footerText: ["Kindly submit the C-zone copy along with the following documents to the Program Office on or before 16th January.", "A copy of your SSLC Book.", "A copy of your Hall Ticket."],
          DB_NAME: "C-Zone",
          idPrefix : "KLM"
        };
      case 'd':
        return {
          name:"D zone",
          primaryColor: rgb(0.52, 0.17, 0.89), 
          headerImagePath: './src/templates/zone_d_participant_ticket_header.png',
          participantCardImagePath: './src/templates/zone_c_participant_card.png',
          participantCardColor: rgb(0.353, 0.231, 0.102),
          footerText: ["Kindly submit the D-zone copy along with the following documents to the Program Office on or before 20th January.", "A copy of your SSLC Book.", "A copy of your Hall Ticket."],
          DB_NAME: "D-Zone",
          idPrefix : "KPM"
        };
      case 'f':
        return {
          name:"F zone",
          primaryColor: rgb(0.35, 0.78, 0.81), 
          headerImagePath: './src/templates/zone_f_participant_ticket_header.png',
          participantCardImagePath: './src/templates/zone_c_participant_card.png',
          participantCardColor: rgb(0.353, 0.231, 0.102),
          footerText: ["Kindly submit the F-zone copy along with the following documents to the Program Office on or before 21st January.", "A copy of your SSLC Book.", "A copy of your Hall Ticket."],
          DB_NAME: "F-Zone",
          idPrefix : "KSK"
        };
      default:
        return null;
    }
};
