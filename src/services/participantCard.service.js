import { PDFDocument, rgb, StandardFonts, layoutMultilineText } from "pdf-lib";
import fs from "fs";
import { getZoneConfig } from "../utils/zoneConfig.js";
import { getZoneEnv } from "../utils/getZoneEnv.js";

// Utility function to sanitize text fields
const sanitizeText = (text) => text.replace(/\t/g, " ");
const zone = getZoneEnv();

// A6 dimensions in points
const A6_WIDTH = 297.6;
const A6_HEIGHT = 419.5;

// A4 dimensions in points
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/**
 * Helper function to draw a single participant card on a page at specified offset
 * @param {Object} params - Drawing parameters
 * @param {Object} params.page - PDF page object
 * @param {Object} params.user - User data
 * @param {Object} params.image - Embedded user image (or null)
 * @param {Object} params.backgroundImage - Embedded background image
 * @param {Object} params.helveticaBold - Bold font
 * @param {Object} params.helvetica - Regular font
 * @param {Object} params.participantCardColor - Card text color
 * @param {number} params.offsetX - X offset for card placement
 * @param {number} params.offsetY - Y offset for card placement
 * @param {number} params.cardWidth - Width of the card
 * @param {number} params.cardHeight - Height of the card
 */
const drawParticipantCard = ({
  page,
  user,
  image,
  backgroundImage,
  helveticaBold,
  helvetica,
  participantCardColor,
  offsetX = 0,
  offsetY = 0,
  cardWidth = A6_WIDTH,
  cardHeight = A6_HEIGHT,
}) => {
  const margin = 30;
  const ticketY = cardHeight - 105;

  // Background Image
  page.drawImage(backgroundImage, {
    x: offsetX,
    y: offsetY,
    width: cardWidth,
    height: cardHeight,
  });

  // Personal Details Section
  const detailsStartX = offsetX + margin + 74; // After photo space
  const detailsStartY = offsetY + ticketY - 83;
  const detailsWidth = cardWidth - margin - 74 - margin + 1;

  if (image) {
    page.drawImage(image, {
      x: offsetX + margin,
      y: detailsStartY,
      width: 67.26,
      height: 83,
    });
  }

  // Draw personal details
  const drawDynamicSizeField = (
    value,
    x,
    y,
    fontSize = 10,
    font = helveticaBold
  ) => {
    const availableWidth = detailsWidth;

    const { lineHeight, lines } = layoutMultilineText(value, {
      font,
      fontSize,
      bounds: {
        width: availableWidth,
      },
    });

    page.drawText(sanitizeText(value) || "", {
      x,
      y: y + (lines.length - 1) * lineHeight,
      font,
      size: fontSize,
      maxWidth: availableWidth,
      lineHeight: lineHeight,
      color: participantCardColor,
    });
    return y + lines.length * lineHeight + 3;
  };

  const middleIndex = Math.max(Math.ceil(user.programs.length / 2), 10);
  const columnOne = user.programs.slice(0, middleIndex);
  const columnTwo = user.programs.slice(middleIndex);

  const collegeY = drawDynamicSizeField(
    user.college,
    detailsStartX,
    detailsStartY,
    10
  );
  const nameY = drawDynamicSizeField(
    user.name,
    detailsStartX,
    collegeY,
    13
  );
  const regIdY = drawDynamicSizeField(
    user.regId,
    detailsStartX,
    nameY - 4,
    9,
    helvetica
  );

  // Programs Section
  const programsY = detailsStartY - 15;
  const programWidth = columnTwo.length > 0 ? (cardWidth - 2 * margin - 3) / 2 : cardWidth - 2 * margin;

  page.drawText("Events", {
    x: offsetX + margin,
    y: programsY - 1,
    font: helveticaBold,
    size: 10,
    color: participantCardColor,
  });

  // Function to draw program section
  const drawProgramSection = (programs, x, y) => {
    if (programs.length === 0) return;
    page.moveTo(x, y - 15);

    programs.forEach((program, index) => {
      const words = program.split(" ");
      const fontSize = 7;
      const availableWidth = programWidth - 2;
      let currentLine = "";
      let lineCount = 1;

      // Simulate text wrapping to count lines
      words.forEach((word) => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = helvetica.widthOfTextAtSize(
          testLine,
          fontSize
        );
        if (testWidth > availableWidth) {
          currentLine = word;
          lineCount++;
        } else {
          currentLine = testLine;
        }
      });

      page.drawText(sanitizeText(program), {
        x,
        font: helvetica,
        size: fontSize,
        lineHeight: 10,
        maxWidth: availableWidth,
      });
      page.moveDown(lineCount * 10 + 1.5);
    });
  };

  // Draw all program sections
  drawProgramSection(
    columnOne.map(sanitizeText),
    offsetX + margin,
    programsY
  );
  drawProgramSection(
    columnTwo.map(sanitizeText),
    offsetX + margin + programWidth + 4,
    programsY
  );
};

/**
 * Helper function to embed user image
 */
const embedUserImage = async (pdfDoc, user) => {
  if (!user.image) return null;

  if (user.image.endsWith(".png")) {
    const pngImageBytes = await fetch(user.image).then((res) =>
      res.arrayBuffer()
    );
    return await pdfDoc.embedPng(pngImageBytes);
  } else if (
    user.image.endsWith(".jpg") ||
    user.image.endsWith(".jpeg")
  ) {
    const jpgImageBytes = await fetch(user.image).then((res) =>
      res.arrayBuffer()
    );
    return await pdfDoc.embedJpg(jpgImageBytes);
  } else {
    throw new Error("Unsupported image format");
  }
};

/**
 * Generate participant cards with each card on a separate A6 page
 * @param {Array} users - Array of user objects
 * @returns {Promise<Uint8Array>} - PDF bytes
 */
export const generateParticipantCards = async (users) => {
  try {
    const { participantCardColor, participantCardImagePath } = getZoneConfig(zone);
    if (!participantCardImagePath || !participantCardColor) {
      throw new Error("Zone configuration not found");
    }

    const pdfDoc = await PDFDocument.create();

    // Embed the standard fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const backgroundFile = fs.readFileSync(participantCardImagePath);
    const backgroundImage = await pdfDoc.embedPng(backgroundFile);

    for (const user of users) {
      const image = await embedUserImage(pdfDoc, user);
      const page = pdfDoc.addPage([A6_WIDTH, A6_HEIGHT]);

      drawParticipantCard({
        page,
        user,
        image,
        backgroundImage,
        helveticaBold,
        helvetica,
        participantCardColor,
        offsetX: 0,
        offsetY: 0,
      });
    }

    return await pdfDoc.save();
  } catch (error) {
    throw error;
  }
};

/**
 * Generate participant cards with 4 A6 cards per A4 page (2x2 grid layout)
 * @param {Array} users - Array of user objects
 * @returns {Promise<Uint8Array>} - PDF bytes
 */
export const generateParticipantCardsCompact = async (users) => {
  try {
    const { participantCardColor, participantCardImagePath } = getZoneConfig(zone);
    if (!participantCardImagePath || !participantCardColor) {
      throw new Error("Zone configuration not found");
    }

    const pdfDoc = await PDFDocument.create();

    // Embed the standard fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const backgroundFile = fs.readFileSync(participantCardImagePath);
    const backgroundImage = await pdfDoc.embedPng(backgroundFile);

    // Pre-embed all user images
    const userImages = await Promise.all(
      users.map((user) => embedUserImage(pdfDoc, user))
    );

    // Card positions on A4 page (2x2 grid)
    // Position 0: Top-left, Position 1: Top-right
    // Position 2: Bottom-left, Position 3: Bottom-right
    const cardPositions = [
      { x: 0, y: A6_HEIGHT + 2.89 },           // Top-left
      { x: A6_WIDTH, y: A6_HEIGHT + 2.89 },    // Top-right
      { x: 0, y: 0 },                   // Bottom-left
      { x: A6_WIDTH, y: 0 },            // Bottom-right
    ];

    let currentPage = null;
    let cardIndex = 0;

    for (let i = 0; i < users.length; i++) {
      const positionOnPage = cardIndex % 4;

      // Create a new A4 page when starting a new group of 4
      if (positionOnPage === 0) {
        currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      }

      const position = cardPositions[positionOnPage];

      drawParticipantCard({
        page: currentPage,
        user: users[i],
        image: userImages[i],
        backgroundImage,
        helveticaBold,
        helvetica,
        participantCardColor,
        offsetX: position.x,
        offsetY: position.y,
      });

      cardIndex++;
    }

    return await pdfDoc.save();
  } catch (error) {
    throw error;
  }
};