import { PDFDocument, rgb, StandardFonts, layoutSinglelineText } from "pdf-lib";
import fs from "fs";
import { getZoneConfig } from "../utils/zoneConfig.js";
import { getZoneEnv } from "../utils/getZoneEnv.js";

// Utility function to sanitize text fields
const sanitizeText = (text) => text.replace(/\t/g, " ");
const zone = getZoneEnv();

export const generateParticipantTickets = async (users) => {
  try {
    const copies = [`${zone.toLocaleUpperCase()}-Zone Copy`, "Student Copy"];
    const { primaryColor, headerImagePath, footerText } = getZoneConfig(zone);
    if (!primaryColor || !headerImagePath) {
      throw new Error("Zone configuration not found");
    }

    const pdfDoc = await PDFDocument.create();

    // Embed the standard fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Define common measurements and styles
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 25;

    const headerImageFile = fs.readFileSync(headerImagePath);
    const headerImage = await pdfDoc.embedPng(headerImageFile);
    const { width: headerImageWidth, height: headerImageHeight } =
      headerImage.scaleToFit(pageWidth - 2 * margin - 20, 150);

    const ticketY = pageHeight - margin - headerImageHeight - 37;

    for (const user of users) {
      let image;
      if (user.image) {
        if (user.image.endsWith(".png")) {
          const pngImageBytes = await fetch(user.image).then((res) =>
            res.arrayBuffer()
          );
          image = await pdfDoc.embedPng(pngImageBytes);
        } else if (
          user.image.endsWith(".jpg") ||
          user.image.endsWith(".jpeg")
        ) {
          const jpgImageBytes = await fetch(user.image).then((res) =>
            res.arrayBuffer()
          );
          image = await pdfDoc.embedJpg(jpgImageBytes);
        } else {
          throw new Error("Unsupported image format");
        }
      } else {
        image = null;
      }

      for (const copy of copies) {
        let nextPage = false;
        const offStagePrograms = [...user.programs.offStage];
        const stagePrograms = [...user.programs.stage];
        const groupPrograms = [...user.programs.group];
        do {
          nextPage = false;
          const page = pdfDoc.addPage([pageWidth, pageHeight]);

          // Header Image
          page.drawImage(headerImage, {
            x: pageWidth / 2 - headerImageWidth / 2,
            y: pageHeight - margin + 10 - headerImageHeight,
            width: headerImageWidth,
            height: headerImageHeight,
          });

          // Participant Ticket Header
          const ticketHeadingY = pageHeight - margin - headerImageHeight - 12;
          if (zone.toLowerCase() === "inter") {
            page.drawRectangle({
              x: 116,
              y: ticketHeadingY,
              width: 360,
              height: 25,
              color: primaryColor,
            })
            page.drawText("Inter-zone Festival", {
              x: 125,
              y: ticketHeadingY + 7,
              font: helveticaBold,
              size: 16,
              color: rgb(1, 1, 1),
            })
            page.drawRectangle({
              x: 273,
              y: ticketHeadingY + 3,
              width: 200,
              height: 19,
              color: rgb(1, 1, 1),
            })
            page.drawText("PARTICIPANT'S TICKET", {
              x: 282,
              y: ticketHeadingY + 7,
              font: helveticaBold,
              size: 16,
            })
          } else {
            page.drawRectangle({
              x: 133,
              y: ticketHeadingY,
              width: 326,
              height: 25,
              color: primaryColor,
            })
            page.drawText("Zone Festival", {
              x: 143,
              y: ticketHeadingY + 7,
              font: helveticaBold,
              size: 16,
              color: rgb(1, 1, 1),
            })
            page.drawRectangle({
              x: 256,
              y: ticketHeadingY + 3,
              width: 200,
              height: 19,
              color: rgb(1, 1, 1),
            })
            page.drawText("PARTICIPANT'S TICKET", {
              x: 265,
              y: ticketHeadingY + 7,
              font: helveticaBold,
              size: 16,
            })
          }

          // Header text
          page.drawText(`( ${copy} )`, {
            x: pageWidth / 2 - 50,
            y: ticketHeadingY - 15,
            size: 12,
          });

          // Draw main ticket container
          page.drawRectangle({
            x: margin,
            y: ticketY - 455,
            width: pageWidth - 2 * margin,
            height: 455,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
          });

          // Personal Details Section
          const detailsStartX = margin + 135.2; // After photo space
          const detailsStartY = ticketY - 10;

          // Draw photo
          if (image) {
            page.drawImage(image, {
              x: margin + 10,
              y: ticketY - 154,
              width: 115.2,
              height: 144,
            });
          }

          // Draw personal details
          const fieldHeight = 24;
          const drawField = (
            label,
            value,
            x,
            y,
            width,
            containerHeight = fieldHeight
          ) => {
            const labelWidth = helveticaBold.widthOfTextAtSize(label, 14);

            page.drawRectangle({
              x,
              y: y - containerHeight,
              width,
              height: containerHeight,
              borderColor: rgb(0, 0, 0),
              borderWidth: 1,
            });

            page.drawText(label, {
              x: x + 5,
              y: y - 17,
              font: helveticaBold,
              size: 14,
            });

            page.drawText(sanitizeText(value) || "", {
              x: x + 10 + labelWidth,
              y: y - 17,
              font: helvetica,
              size: 14,
              maxWidth: width - labelWidth - 15,
              lineHeight: 20,
            });
          };

          const drawDynamicSizeField = (
            label,
            value,
            x,
            y,
            width,
            containerHeight = fieldHeight
          ) => {
            const labelWidth = helveticaBold.widthOfTextAtSize(label, 14);
            const valueWidth = helvetica.widthOfTextAtSize(value, 14);
            let valueFontSize = 14;
            const availableWidth = width - labelWidth - 15;

            if (valueWidth > availableWidth) {
              const { fontSize } = layoutSinglelineText(value, {
                font: helvetica,
                bounds: {
                  width: availableWidth,
                },
              });
              valueFontSize = fontSize;
            }

            page.drawRectangle({
              x,
              y: y - containerHeight,
              width,
              height: containerHeight,
              borderColor: rgb(0, 0, 0),
              borderWidth: 1,
            });

            page.drawText(label, {
              x: x + 5,
              y: y - 17,
              font: helveticaBold,
              size: 14,
            });

            page.drawText(sanitizeText(value) || "", {
              x: x + 10 + labelWidth,
              y: y - 17,
              font: helvetica,
              size: valueFontSize,
              maxWidth: availableWidth,
              lineHeight: 20,
            });
          };

          // Draw all personal details fields
          const detailsWidth = pageWidth - detailsStartX - margin - 10;
          drawDynamicSizeField(
            "Name:",
            user.name,
            detailsStartX,
            detailsStartY,
            detailsWidth
          );
          drawField(
            "Reg ID:",
            user.regId,
            detailsStartX,
            detailsStartY - fieldHeight,
            detailsWidth / 2
          );
          drawField(
            "Sex:",
            user.sex,
            detailsStartX + detailsWidth / 2,
            detailsStartY - fieldHeight,
            detailsWidth / 2
          );
          drawField(
            "College:",
            user.college,
            detailsStartX,
            detailsStartY - 2 * fieldHeight,
            detailsWidth,
            2 * fieldHeight
          );
          drawDynamicSizeField(
            "Course:",
            sanitizeText(user.course),
            detailsStartX,
            detailsStartY - 4 * fieldHeight,
            detailsWidth
          );
          drawField(
            "Semester:",
            user.semester,
            detailsStartX,
            detailsStartY - 5 * fieldHeight,
            detailsWidth / 2
          );
          drawField(
            "Date of Birth:",
            user.dateOfBirth,
            detailsStartX + detailsWidth / 2,
            detailsStartY - 5 * fieldHeight,
            detailsWidth / 2
          );

          // Programs Section
          const programsY = ticketY - 190;
          const programWidth = (pageWidth - 2 * margin - 20) / 3;

          // Function to draw program section
          const drawProgramSection = (title, programs, x, y) => {
            // Header
            page.drawRectangle({
              x,
              y,
              width: programWidth,
              height: 25,
              color: primaryColor,
            });

            const titleWidth = helveticaBold.widthOfTextAtSize(title, 12);
            page.drawText(title, {
              x: x + programWidth / 2 - titleWidth / 2,
              y: y + 8,
              font: helveticaBold,
              size: 12,
              color: rgb(1, 1, 1),
            });

            // Content area
            page.drawRectangle({
              x,
              y: y - 260,
              width: programWidth,
              height: 285,
              borderColor: rgb(0, 0, 0),
              borderWidth: 1,
            });

            // Draw programs
            let totalLines = 0;
            let pageBreakTriggered = false;
            page.moveTo(x, y - 15);

            programs.forEach((program, index) => {
              if (pageBreakTriggered) return;

              const programText = `• ${program}`;
              const words = programText.split(" ");
              const fontSize = 10;
              const availableWidth = programWidth - 10;
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

              totalLines += lineCount;

              if (totalLines > 15) {
                nextPage = true;
                pageBreakTriggered = true;
                programs.splice(0, index);
                return;
              } else if (index === programs.length - 1) {
                programs.splice(0, index + 1);
              }

              page.drawText(sanitizeText(programText), {
                x: x + 5,
                font: helvetica,
                size: fontSize,
                lineHeight: 14.5,
                maxWidth: availableWidth,
              });
              page.moveDown(lineCount * 14.5 + 2);
            });
          };

          // Draw all program sections
          drawProgramSection(
            "Off Stage",
            offStagePrograms.map(sanitizeText),
            margin + 5,
            programsY
          );
          drawProgramSection(
            "Stage",
            stagePrograms.map(sanitizeText),
            margin + programWidth + 10,
            programsY
          );
          drawProgramSection(
            "Group",
            groupPrograms.map(sanitizeText),
            margin + 2 * programWidth + 15,
            programsY
          );

          // Signature section
          const signatureY = ticketY - 540;
          page.drawText("Principal Signature & Seal", {
            x: margin + 5,
            y: signatureY,
            font: helvetica,
            size: 12,
          });

          if (copy === "Student Copy") {
            page.drawText("University Union Councillor (UUC)", {
              x: pageWidth / 2 - 90,
              y: signatureY,
              font: helvetica,
              size: 12,
            });

            page.drawText(`${zone.toLocaleUpperCase()}-Zone General Convenor`, {
              x: pageWidth - margin - 145,
              y: signatureY,
              font: helvetica,
              size: 12,
            });
            page.drawText(`(For ${zone.toLocaleUpperCase()}-zone office use)`, {
              x: pageWidth - margin - 125,
              y: signatureY - 13,
              font: helvetica,
              size: 10,
            });
          } else {
            page.drawText("University Union Councillor (UUC)", {
              x: pageWidth - margin - 186,
              y: signatureY,
              font: helvetica,
              size: 12,
            });
          }

          if (footerText) {
            // Footer notes
            const footerY = margin + 45;
            page.drawText("Notes:", {
              x: margin,
              y: footerY,
              font: helveticaBold,
              size: 12,
            });
            page.moveTo(margin, footerY - 15);

            footerText.forEach((note) => {
              page.drawText(`• ${sanitizeText(note)}`, {
                x: margin,
                font: helvetica,
                size: 10,
              });
              page.moveDown(15);
            });
          }
        } while (nextPage);
      }
    }

    return await pdfDoc.save();
  } catch (error) {
    throw error;
  }
};

export const generateProgramParticipantsList = async (program) => {
  try {
    const { headerImagePath } = getZoneConfig(zone);
    if (!headerImagePath) {
      throw new Error("Zone configuration not found");
    }
    const pdfDoc = await PDFDocument.create();

    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Define measurements
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 25;

    // Define column widths (Total: 545)
    const columnWidths = {
      slNo: 35,
      name: 270,
      registration: 80,
      chestNo: 80,
      signature: 80
    };

    // Embed header image
    const headerImageFile = fs.readFileSync(headerImagePath);
    const headerImage = await pdfDoc.embedPng(headerImageFile);
    const { width: headerImageWidth, height: headerImageHeight } =
      headerImage.scaleToFit(pageWidth - 2 * margin, 100);

    // Calculate different start positions and row counts for first and subsequent pages
    let firstPageTableStartY = pageHeight - 145; // Accounts for header image and title
    let otherPagesTableStartY = pageHeight - 45; // Starts from top with space for program name
    const rowHeight = 33;
    const headerHeight = 25;
    const firstPageMaxRows = Math.floor((firstPageTableStartY - margin - 50) / rowHeight);
    const otherPagesMaxRows = Math.floor((otherPagesTableStartY - margin - 50) / rowHeight);

    // Helper function to create a new page
    const createPage = (pageNumber, totalPages) => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const programText = `ITEM: ${sanitizeText(program.name)}`;
      const programTypeWidth = helveticaBold.widthOfTextAtSize(program.type, 12);
      const programMaxwidth = pageWidth - 2 * margin - programTypeWidth - 10;

      // Only add header image to first page
      if (pageNumber === 1) {
        page.drawImage(headerImage, {
          x: pageWidth / 2 - headerImageWidth / 2,
          y: pageHeight - margin - headerImageHeight,
          width: headerImageWidth,
          height: headerImageHeight,
        });

        const programNameNoOfLines = Math.ceil(helveticaBold.widthOfTextAtSize(programText, 12) / programMaxwidth);
        firstPageTableStartY -= programNameNoOfLines * 15;
        otherPagesTableStartY -= programNameNoOfLines * 15;
      }

      const programDetailsY = pageNumber === 1 ? pageHeight - margin - headerImageHeight - 20 : pageHeight - margin - 20;
      page.drawText(programText, {
        x: margin,
        y: programDetailsY,
        font: helveticaBold,
        size: 12,
        maxWidth: programMaxwidth,
        lineHeight: 15
      });
      page.drawText(program.type, {
        x: pageWidth - margin - helveticaBold.widthOfTextAtSize(program.type, 12) - 5,
        y: programDetailsY,
        font: helveticaBold,
        size: 12
      })

      // Draw page number
      page.drawText(`Page ${pageNumber} of ${totalPages}`, {
        x: pageWidth - margin - 45,
        y: margin,
        font: helvetica,
        size: 8,
        color: rgb(0.5, 0.5, 0.5)
      });

      return page;
    };

    // Helper function to draw table headers
    const drawTableHeaders = (page, y) => {
      let x = margin;
      const headers = [
        { text: "Sl.No", width: columnWidths.slNo },
        { text: "Name", width: columnWidths.name },
        { text: "Registration", width: columnWidths.registration },
        { text: "Chest No", width: columnWidths.chestNo },
        { text: "Signature", width: columnWidths.signature }
      ];

      // Draw header background
      page.drawRectangle({
        x: margin,
        y: y,
        width: pageWidth - 2 * margin,
        height: headerHeight,
        color: rgb(0.9, 0.9, 0.9)
      });

      // Draw header texts
      headers.forEach(header => {
        page.drawRectangle({
          x,
          y: y,
          width: header.width,
          height: headerHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1
        })

        page.drawText(header.text, {
          x: x + 5,
          y: y + 8,
          font: helveticaBold,
          size: 10
        });

        x += header.width;
      });
    };

    // Calculate total pages needed
    let remainingParticipants = program.participants.length;
    let totalPages = 1; // Start with 1 for first page
    remainingParticipants -= firstPageMaxRows;

    if (remainingParticipants > 0) {
      totalPages += Math.ceil(remainingParticipants / otherPagesMaxRows);
    }

    // Generate pages
    let currentPage = 1;
    let processedParticipants = 0;

    while (processedParticipants < program.participants.length) {
      const page = createPage(currentPage, totalPages);
      const maxRows = currentPage === 1 ? firstPageMaxRows : otherPagesMaxRows;
      const startY = currentPage === 1 ? firstPageTableStartY : otherPagesTableStartY;

      const pageParticipants = program.participants.slice(
        processedParticipants,
        processedParticipants + maxRows
      );

      let y = startY - headerHeight;
      drawTableHeaders(page, y);
      y -= rowHeight;

      // Draw participant rows
      pageParticipants.forEach((participant, index) => {
        let x = margin;
        const rowData = [
          { text: (processedParticipants + index + 1).toString(), width: columnWidths.slNo },
          {
            text: sanitizeText(participant.name),
            collegeText: sanitizeText(participant.college),
            width: columnWidths.name
          },
          { text: "", width: columnWidths.registration },
          { text: "", width: columnWidths.chestNo },
          { text: "", width: columnWidths.signature }
        ];

        // Draw row background (alternate colors)
        page.drawRectangle({
          x: margin,
          y: y,
          width: pageWidth - 2 * margin,
          height: rowHeight,
          color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.95, 0.95, 0.95)
        });

        // Draw row data
        rowData.forEach(data => {
          // Draw cell border
          page.drawRectangle({
            x,
            y: y,
            width: data.width,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1
          })

          if (data.collegeText) {
            // Draw name on top
            page.drawText(data.text, {
              x: x + 5,
              y: y + 18,
              font: helvetica,
              size: 10,
              maxWidth: data.width - 7
            });
            // Draw college below
            let collegeFontsize = 8;
            const collegeWidth = helvetica.widthOfTextAtSize(data.collegeText, collegeFontsize);
            if (collegeWidth > data.width - 7) {
              const { fontSize } = layoutSinglelineText(data.collegeText, {
                font: helvetica,
                bounds: {
                  width: data.width - 7,
                },
              });
              collegeFontsize = fontSize;
            }
            page.drawText(data.collegeText, {
              x: x + 5,
              y: y + 6,
              font: helvetica,
              size: collegeFontsize,
              maxWidth: data.width - 7,
              color: rgb(0.4, 0.4, 0.4)
            });
          } else {
            page.drawText(data.text, {
              x: x + 5,
              y: y + 12,
              font: helvetica,
              size: 10,
              maxWidth: data.width - 7
            });
          }

          x += data.width;
        });

        y -= rowHeight;
      });

      processedParticipants += pageParticipants.length;
      currentPage++;
    }

    return await pdfDoc.save();
  } catch (error) {
    throw error;
  }
};

export const generateGroupProgramParticipantsList = async (program) => {
  try {
    const { headerImagePath } = getZoneConfig(zone);
    if (!headerImagePath) {
      throw new Error("Zone configuration not found");
    }
    const pdfDoc = await PDFDocument.create();

    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Define measurements
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 25;

    // Define column widths (Total: 545)
    const columnWidths = {
      slNo: 35,
      name: 270,
      registration: 80,
      chestNo: 80,
      signature: 80
    };

    // Embed header image
    const headerImageFile = fs.readFileSync(headerImagePath);
    const headerImage = await pdfDoc.embedPng(headerImageFile);
    const { width: headerImageWidth, height: headerImageHeight } =
      headerImage.scaleToFit(pageWidth - 2 * margin, 100);

    // Calculate different start positions and row counts
    let firstPageTableStartY = pageHeight - 145;
    let otherPagesTableStartY = pageHeight - 45;
    const headerHeight = 25;

    // Dynamic row height calculation based on number of participants
    const getRowHeight = (group) => {
      const participantCount = group.participants.length;
      const noOfLinesForCollege = Math.ceil(helveticaBold.widthOfTextAtSize(sanitizeText(group.college), 10) / (columnWidths.name - 10));
      const collegeNameHeight = noOfLinesForCollege * 13 + 10;
      // Height per participant name (assuming 12 points per name)
      const participantHeight = 12;
      return collegeNameHeight + (participantCount * participantHeight);
    };

    // Helper function to create a new page
    const createPage = (pageNumber, totalPages) => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const programText = `ITEM: ${sanitizeText(program.name)}`;
      const programTypeWidth = helveticaBold.widthOfTextAtSize(program.type, 12);
      const programMaxwidth = pageWidth - 2 * margin - programTypeWidth - 10;
      // Only add header image to first page
      if (pageNumber === 1) {
        page.drawImage(headerImage, {
          x: pageWidth / 2 - headerImageWidth / 2,
          y: pageHeight - margin - headerImageHeight,
          width: headerImageWidth,
          height: headerImageHeight,
        });

        const programNameNoOfLines = Math.ceil(helveticaBold.widthOfTextAtSize(programText, 12) / programMaxwidth);
        firstPageTableStartY -= programNameNoOfLines * 15;
        otherPagesTableStartY -= programNameNoOfLines * 15;
      }

      const programDetailsY = pageNumber === 1 ? pageHeight - margin - headerImageHeight - 20 : pageHeight - margin - 20;
      page.drawText(programText, {
        x: margin,
        y: programDetailsY,
        font: helveticaBold,
        maxWidth: programMaxwidth,
        lineHeight: 15,
        size: 12
      });
      page.drawText(program.type, {
        x: pageWidth - margin - programTypeWidth - 5,
        y: programDetailsY,
        font: helveticaBold,
        size: 12
      });

      // Draw page number
      page.drawText(`Page ${pageNumber} of ${totalPages}`, {
        x: pageWidth - margin - 45,
        y: margin,
        font: helvetica,
        size: 8,
        color: rgb(0.5, 0.5, 0.5)
      });

      return page;
    };

    // Helper function to draw table headers
    const drawTableHeaders = (page, y) => {
      let x = margin;
      const headers = [
        { text: "Sl.No", width: columnWidths.slNo },
        { text: "College & Participants", width: columnWidths.name },
        { text: "Registration", width: columnWidths.registration },
        { text: "Chest No", width: columnWidths.chestNo },
        { text: "Signature", width: columnWidths.signature }
      ];

      // Draw header background
      page.drawRectangle({
        x: margin,
        y: y,
        width: pageWidth - 2 * margin,
        height: headerHeight,
        color: rgb(0.9, 0.9, 0.9)
      });

      // Draw header texts
      headers.forEach(header => {
        page.drawRectangle({
          x,
          y: y,
          width: header.width,
          height: headerHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1
        });

        page.drawText(header.text, {
          x: x + 5,
          y: y + 8,
          font: helveticaBold,
          size: 10
        });

        x += header.width;
      });
    };

    // Calculate pages needed based on dynamic row heights
    let currentY = firstPageTableStartY - headerHeight;
    let currentPage = 1;
    let pageBreaks = [0];
    let currentGroupIndex = 0;

    while (currentGroupIndex < program.participants.length) {

      const rowHeight = getRowHeight(program.participants[currentGroupIndex]);

      if (currentY - rowHeight < margin + 20) {
        pageBreaks.push(currentGroupIndex);
        currentY = otherPagesTableStartY - headerHeight;
        currentPage++;
      }

      currentY -= rowHeight;
      currentGroupIndex++;
    }

    // Generate pages
    let processedGroups = 0;
    currentPage = 1;

    for (let pageIndex = 0; pageIndex < pageBreaks.length; pageIndex++) {
      const page = createPage(currentPage, pageBreaks.length);
      const startY = currentPage === 1 ? firstPageTableStartY : otherPagesTableStartY;

      let y = startY - headerHeight;
      drawTableHeaders(page, y);

      const nextBreak = pageBreaks[pageIndex + 1] || program.participants.length;
      const pageGroups = program.participants.slice(pageBreaks[pageIndex], nextBreak);

      for (const group of pageGroups) {
        const rowHeight = getRowHeight(group);
        let x = margin;

        // Draw row background
        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: pageWidth - 2 * margin,
          height: rowHeight,
          color: processedGroups % 2 === 0 ? rgb(1, 1, 1) : rgb(0.95, 0.95, 0.95)
        });

        // Draw cells
        Object.values(columnWidths).forEach((width, index) => {
          // Draw cell border
          page.drawRectangle({
            x,
            y: y - rowHeight,
            width,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1
          });

          if (index === 0) {
            // Draw serial number
            page.drawText((processedGroups + 1).toString(), {
              x: x + 5,
              y: y - rowHeight / 2,
              font: helvetica,
              size: 10
            });
          } else if (index === 1) {
            // Draw college name
            const noOfLinesForCollege = Math.ceil(helveticaBold.widthOfTextAtSize(sanitizeText(group.college), 10) / (width - 10));
            page.drawText(sanitizeText(group.college), {
              x: x + 5,
              y: y - 15,
              font: helveticaBold,
              size: 10,
              lineHeight: 13,
              maxWidth: width - 8
            });

            // Draw participant names
            let participantY = y - noOfLinesForCollege * 13 - 14;
            group.participants.forEach(participant => {
              page.drawText(sanitizeText(participant), {
                x: x + 7,
                y: participantY,
                font: helvetica,
                size: 9,
                maxWidth: width - 10,
                color: rgb(0.4, 0.4, 0.4)
              });
              participantY -= 12;
            });
          }

          x += width;
        });

        y -= rowHeight;
        processedGroups++;
      }

      currentPage++;
    }

    return await pdfDoc.save();
  } catch (error) {
    throw error;
  }
};
