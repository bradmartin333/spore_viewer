/**
 * Initializes the canvas and sets its dimensions.
 */
const canvas = document.getElementById('image-canvas');
canvas.width = 800;
canvas.height = 600;

/**
 * The initial source of the gkhead image.
 */
const initialImage = "start.png";

/**
 * Creates a new Image object for the head image.
 */
const gkhead = new Image();

/**
 * Creates a new Image object for the secondary image.
 */
const gkhead2 = new Image();

/**
 * Array to store the points drawn on the canvas. Each point is an object
 * with x, y, and idx properties.
 */
const points = [];

/**
 * Array to store the lines drawn on the canvas. Each line is an object
 * with x1, y1, x2, and y2 properties.
 */
const lines = [];

/**
 * Array to store the blobs (pairs of lines) drawn on the canvas. Each
 * blob is an object containing two line objects: line1 and line2.
 */
const blobs = [];

/**
 * Array to store the user calibrations. Each calibration is a combination
 * of a line segment pixel count and a true measurement in micrometers.
 */
const calibrations = [];

/**
 * Variable to store the initialization state of opencv
 */
let opencvInitialized = false;

/**
 * Calculates the Euclidean distance between two points.
 * @param {number} x1 - The x-coordinate of the first point.
 * @param {number} y1 - The y-coordinate of the first point.
 * @param {number} x2 - The x-coordinate of the second point.
 * @param {number} y2 - The y-coordinate of the second point.
 * @returns {number} - The distance between the two points.
 */
const distance = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

/**
 * Returns the state of calibration mode.
 * @returns {boolean} - True if calibration mode is active, false otherwise.
 */
const isCalibrationMode = () => {
    const scaleMode = document.getElementById('scaleMode');
    return scaleMode.classList.contains('scale-mode-on');
}

/** 
 * Checks if the 'visited' key is present in local storage.
 * If not, it sets it to 'true' and returns true.
 * @returns {boolean} - True if it's the first visit, false otherwise.
 */
function isFirstVisit() {
    const questionIcon = document.querySelector('.fa-circle-question');
    if (localStorage.getItem('visited') === null) {
        localStorage.setItem('visited', 'true');
        if (questionIcon) {
            questionIcon.style.color = 'green';
        }
        return true;
    }
    if (questionIcon) {
        questionIcon.style.color = 'black';
    }
    return false;
}

/**
 * Adjusts the label position to prevent overlap with line endpoints.
 * @param {number} x - The initial x-coordinate of the label.
 * @param {number} y - The initial y-coordinate of the label.
 * @param {object} line - The line object {x1, y1, x2, y2}.
 * @param {number} labelWidth - The width of the label text.
 * @returns {object} - The adjusted x and y coordinates of the label.
 */
function adjustLabelPosition(x, y, line, labelWidth) {
    const ctx = canvas.getContext('2d');
    const zoom = ctx.getTransform().a; // Get the current zoom level
    const buffer = 10 / zoom; // Adjust the buffer based on zoom level

    let newX = x;
    let newY = y;

    // Check if label overlaps with line endpoints, adjust if necessary
    if (Math.abs(x - line.x1) < buffer && Math.abs(y - line.y1) < buffer) {
        newX = line.x1 + (line.x1 > line.x2 ? -labelWidth - buffer : buffer);
        newY = line.y1 + (line.y1 > line.y2 ? -buffer : buffer);
    } else if (Math.abs(x - line.x2) < buffer && Math.abs(y - line.y2) < buffer) {
        newX = line.x2 + (line.x2 > line.x1 ? buffer : -labelWidth - buffer);
        newY = line.y2 + (line.y2 > line.y1 ? buffer : -buffer);
    }

    return { x: newX, y: newY };
}

/**
 * Redraws the canvas with the current image, transformations, and drawn elements.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
function redraw(ctx) {
    // Clear the canvas based on the current transformation
    const p1 = ctx.transformedPoint(0, 0);
    const p2 = ctx.transformedPoint(canvas.width, canvas.height);
    ctx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

    // Save the current context state
    ctx.save();

    // Scale and center the image
    const scaleX = canvas.width / gkhead.width;
    const scaleY = canvas.height / gkhead.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - gkhead.width * scale) / 2;
    const offsetY = (canvas.height - gkhead.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill the entire canvas with the selected color
    const canvasColor = localStorage.getItem('canvasColor') || '#ffffff';
    ctx.fillStyle = canvasColor;
    ctx.fillRect(-canvas.width * 10, -canvas.height * 10, canvas.width * 30, canvas.height * 30);
    ctx.restore();

    // Draw the image
    ctx.drawImage(gkhead, 0, 0);

    ctx.save(); // Save again for drawing elements with zoom/pan

    // Draw blobs (pairs of perpendicular lines)
    blobs.forEach(blob => {
        // Draw the first line of the blob
        ctx.beginPath();
        ctx.moveTo(blob.line1.x1, blob.line1.y1);
        ctx.lineTo(blob.line1.x2, blob.line1.y2);
        ctx.strokeStyle = 'purple';
        ctx.lineWidth = 2 / ctx.getTransform().a; // Adjust line width based on zoom
        ctx.stroke();
        ctx.closePath();

        // Draw the second line of the blob
        ctx.beginPath();
        ctx.moveTo(blob.line2.x1, blob.line2.y1);
        ctx.lineTo(blob.line2.x2, blob.line2.y2);
        ctx.strokeStyle = 'purple';
        ctx.lineWidth = 2 / ctx.getTransform().a; // Adjust line width based on zoom
        ctx.stroke();
        ctx.closePath();

        // Display line lengths
        let line1Length = distance(blob.line1.x1, blob.line1.y1, blob.line1.x2, blob.line1.y2);
        let line2Length = distance(blob.line2.x1, blob.line2.y1, blob.line2.x2, blob.line2.y2);
        let units = 'px';
        ctx.font = `${12 / ctx.getTransform().a}px Arial`; // Adjust font size based on zoom
        ctx.fillStyle = 'black';

        // If an active calibration is selected, convert the lengths to micrometers
        const activeCalibration = localStorage.getItem('activeCalibration');
        if (activeCalibration) {
            const calibration = calibrations.find(cal => cal.name === activeCalibration);
            if (calibration) {
                const pxPerMicron = calibration.value;
                line1Length /= pxPerMicron;
                line2Length /= pxPerMicron;
                units = 'µm';
            }
        }

        const textLine1 = `${line1Length.toFixed(2)} ${units}`;
        const textLine2 = `${line2Length.toFixed(2)} ${units}`;
        const textMetricsLine1 = ctx.measureText(textLine1);
        const textMetricsLine2 = ctx.measureText(textLine2);
        const labelWidthLine1 = textMetricsLine1.width;
        const labelWidthLine2 = textMetricsLine2.width;

        // Draw text near the second endpoint of line1
        const label1Pos = adjustLabelPosition(blob.line1.x2, blob.line1.y2, blob.line1, labelWidthLine1);
        ctx.fillText(textLine1, label1Pos.x, label1Pos.y);

        // Draw text near the second endpoint of line2
        const label2Pos = adjustLabelPosition(blob.line2.x2, blob.line2.y2, blob.line2, labelWidthLine2);
        ctx.fillText(textLine2, label2Pos.x, label2Pos.y);
    });

    // Draw individual lines
    lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 3 / ctx.getTransform().a; // Adjust line width based on zoom
        ctx.stroke();
        ctx.closePath();
    });

    // Draw points
    points.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5 / ctx.getTransform().a, 0, 2 * Math.PI); // Adjust radius based on zoom
        ctx.fillStyle = isCalibrationMode() ? 'yellow' : point.idx > 1 ? 'green' : 'red';
        ctx.fill();
        ctx.closePath();
    });


    // Draw the secondary image if it exists
    // Scale the image to 30% of the gkhead width and position it at the bottom center
    if (gkhead2.src) {
        const offsetX = 0.3 * gkhead.width;
        const scale = offsetX / gkhead2.width;
        const offsetY = 0.85 * gkhead.height;
        ctx.drawImage(gkhead2, offsetX, offsetY, gkhead2.width * scale, gkhead2.height * scale);
    }

    // Scale bar
    const barColor = localStorage.getItem('barColor') || 'black';
    const insetX = 10;
    const insetY = 10;
    const bottomLeft = ctx.transformedPoint(insetX, canvas.height - insetY);
    let scaleBarLength = 100.0 / ctx.getTransform().a;
    // If the scale bar length is greater than 10, 
    // round it to the nearest multiple of 10.
    if (scaleBarLength > 10) {
        scaleBarLength = Math.round(scaleBarLength / 10) * 10;
    } else {
        scaleBarLength = Math.round(scaleBarLength);
    }
    let scaleBarValue = scaleBarLength; // Default value in pixels
    const activeCalibration = localStorage.getItem('activeCalibration');
    let activePxPerMicron = 1.0;
    if (activeCalibration) {
        const calibration = calibrations.find(cal => cal.name === activeCalibration);
        if (calibration) {
            activePxPerMicron = calibration.value;
            scaleBarValue /= activePxPerMicron; // Convert to micrometers
            if (scaleBarValue > 1) {
                scaleBarValue = scaleBarValue.toFixed(0);
            }
            else {
                scaleBarValue = scaleBarValue.toFixed(2);
            }
        }
    }
    if (scaleBarLength >= 1) {
        // Draw the scale bar
        ctx.beginPath();
        ctx.moveTo(bottomLeft.x, bottomLeft.y);
        ctx.lineTo(bottomLeft.x + scaleBarLength, bottomLeft.y);
        ctx.strokeStyle = barColor;
        ctx.lineWidth = 5 / ctx.getTransform().a;
        ctx.stroke();
        ctx.closePath();

        // Draw scale bar text aligned in the center of the scale bar horizontally
        ctx.font = `bold ${12 / ctx.getTransform().a}px Arial`;
        ctx.fillStyle = barColor;
        const scaleText = `${scaleBarValue} ${activeCalibration ? 'µm' : 'px'}`;
        const textMetrics = ctx.measureText(scaleText);
        const labelWidth = textMetrics.width;
        const labelPos = {
            x: bottomLeft.x + scaleBarLength / 2 - labelWidth / 2,
            y: bottomLeft.y - 7 / ctx.getTransform().a
        };
        ctx.fillText(scaleText, labelPos.x, labelPos.y);
    }


    let dataString = "";

    // If local storage contains the array 'note', append each note to the data string
    const notes = JSON.parse(localStorage.getItem('notes')) || [];
    if (notes.length > 0) {
        notes.forEach(note => {
            dataString += note + "\n";
        });
    }

    if (isFirstVisit()) {
        dataString = "welcome to spore viewer!\n" +
            "click the ? below to learn how to use this tool";
    } else if (blobs.length > 0) {
        if (dataString.length > 0) {
            dataString += "\n";
        }
        stats = calculateBlobData(blobs);
        const dataUnit = activeCalibration ? 'µm' : 'px';
        dataString += `range = (${stats.minX} - ${stats.maxX}) x (${stats.minY} - ${stats.maxY}) ${dataUnit}\n` +
            `avg = ${stats.averageX} x ${stats.averageY} ${dataUnit}, n = ${stats.count}, Q = ${(stats.averageX / stats.averageY).toFixed(2)}\n` +
            `stddev = ${stats.standardDeviationX} x ${stats.standardDeviationY} ${dataUnit}${activeCalibration ? `, ${activeCalibration} (${activePxPerMicron} px/µm)` : ''}\n`;
    }

    if (dataString.length > 0) {
        dataString += "\n";
    }
    dataString += "tinyurl.com/sporeviewer";

    // Draw the data string
    if (dataString.length > 0) {
        const bottomRight = ctx.transformedPoint(canvas.width - insetX, canvas.height - insetY);
        ctx.font = `bold ${12 / ctx.getTransform().a}px Arial`;
        ctx.fillStyle = 'black';
        const dataLines = dataString.split('\n');
        dataLines.reverse();
        const longestLine = dataLines.reduce((a, b) => a.length > b.length ? a : b, '');
        const textMetrics = ctx.measureText(longestLine);
        const labelWidth = textMetrics.width;
        const labelPos = {
            x: bottomRight.x - labelWidth - 10 / ctx.getTransform().a,
            y: bottomRight.y - 10 / ctx.getTransform().a
        };
        ctx.fillStyle = canvasColor;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(labelPos.x - 5 / ctx.getTransform().a,
            labelPos.y - 15 / ctx.getTransform().a * dataLines.length,
            labelWidth + 10 / ctx.getTransform().a,
            16 / ctx.getTransform().a * dataLines.length);
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = barColor;
        dataLines.forEach((line, index) => {
            ctx.fillText(line, labelPos.x, labelPos.y - index * 15 / ctx.getTransform().a);
        });
    }

    // Restore the context state
    ctx.restore();
}

/**
 * Checks if two line segments intersect.
 * @param {object} p1 - The starting point of the first line segment {x, y}.
 * @param {object} q1 - The ending point of the first line segment {x, y}.
 * @param {object} p2 - The starting point of the second line segment {x, y}.
 * @param {object} q2 - The ending point of the second line segment {x, y}.
 * @returns {object} - An object indicating if the segments intersect
 * (intersect: boolean) and the intersection point (point: {x, y} | null).
 */
function lineSegmentIntersection(p1, q1, p2, q2) {
    /**
     * Calculates the orientation of three points (p, q, r).
     * Returns:
     * 0 if the points are collinear.
     * 1 if the points are clockwise.
     * -1 if the points are counterclockwise.
     * @param {object} p - The first point {x, y}.
     * @param {object} q - The second point {x, y}.
     * @param {object} r - The third point {x, y}.
     * @returns {number} - The orientation of the three points.
     */
    function orientation(p, q, r) {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (val === 0) return 0; // Collinear
        return (val > 0) ? 1 : -1; // Clockwise or counterclockwise
    }

    /**
     * Checks if a point 'p' lies on the line segment 'p1q1'.
     * @param {object} p - The point to check {x, y}.
     * @param {object} p1 - The starting point of the segment {x, y}.
     * @param {object} q1 - The ending point of the segment {x, y}.
     * @returns {boolean} - True if the point lies on the segment, false otherwise.
     */
    function onSegment(p, p1, q1) {
        return (
            p.x <= Math.max(p1.x, q1.x) &&
            p.x >= Math.min(p1.x, q1.x) &&
            p.y <= Math.max(p1.y, q1.y) &&
            p.y >= Math.min(p1.y, q1.y)
        );
    }

    // Calculate orientations
    const orient1 = orientation(p1, q1, p2);
    const orient2 = orientation(p1, q1, q2);
    const orient3 = orientation(p2, q2, p1);
    const orient4 = orientation(p2, q2, q1);

    // General case: Segments intersect if orientations are different
    if (orient1 !== orient2 && orient3 !== orient4) {
        // Calculate intersection point using parametric equations
        const denominator = ((p1.x - q1.x) * (p2.y - q2.y) - (p1.y - q1.y) * (p2.x - q2.x));
        if (denominator === 0) {
            return { intersect: false, point: null }; // Parallel lines
        }
        const t = ((p1.x - p2.x) * (p2.y - q2.y) - (p1.y - p2.y) * (p2.x - q2.x)) / denominator;
        const u = -((p1.x - q1.x) * (p1.y - p2.y) - (p1.y - q1.y) * (p1.x - p2.x)) / denominator;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            const intersectionX = p1.x + t * (q1.x - p1.x);
            const intersectionY = p1.y + t * (q1.y - p1.y);
            return { intersect: true, point: { x: intersectionX, y: intersectionY } };
        } else {
            return { intersect: false, point: null }; // Intersection outside segments
        }
    }

    // Special cases: Collinear points
    if (orient1 === 0 && onSegment(p2, p1, q1)) return { intersect: true, point: p2 };
    if (orient2 === 0 && onSegment(q2, p1, q1)) return { intersect: true, point: q2 };
    if (orient3 === 0 && onSegment(p1, p2, q2)) return { intersect: true, point: p1 };
    if (orient4 === 0 && onSegment(q1, p2, q2)) return { intersect: true, point: q1 };

    // No intersection
    return { intersect: false, point: null };
}

/**
 * Checks if a point lies between the perpendicular lines passing through the
 * endpoints of a line segment.
 * @param {number[]} point - The point to check [x, y].
 * @param {number[]} segmentStart - The starting point of the segment [x, y].
 * @param {number[]} segmentEnd - The ending point of the segment [x, y].
 * @returns {boolean} - True if the point is between the perpendiculars, false otherwise.
 */
function isPointBetweenPerpendiculars(point, segmentStart, segmentEnd) {
    // Handle the case where the segment is a single point
    if (segmentStart[0] === segmentEnd[0] && segmentStart[1] === segmentEnd[1]) {
        return true; // Consider the point to be "between"
    }

    // Calculate the vector of the line segment
    const segmentVector = [segmentEnd[0] - segmentStart[0], segmentEnd[1] - segmentStart[1]];

    // Calculate the vector from the start point to the given point
    const pointToStartVector = [point[0] - segmentStart[0], point[1] - segmentStart[1]];

    // Calculate the dot product
    const dot1 = segmentVector[0] * pointToStartVector[0] + segmentVector[1] * pointToStartVector[1];

    // Calculate the vector from the end point to the given point
    const pointToEndVector = [point[0] - segmentEnd[0], point[1] - segmentEnd[1]];

    // Calculate the dot product
    const dot2 = segmentVector[0] * pointToEndVector[0] + segmentVector[1] * pointToEndVector[1];

    // The point is between the perpendiculars if the dot products have opposite signs or one is zero
    return (dot1 <= 0 && dot2 >= 0) || (dot1 >= 0 && dot2 <= 0);
}

/**
 * Calculates various statistics for the given blobs.
 * @param {Array} blobs An array of blob objects, each containing two lines.
 * @returns {Object} An object containing the calculated statistics:
 ** averageX: Average x-coordinate of the blob endpoints.
 ** averageY: Average y-coordinate of the blob endpoints.
 ** minX: Minimum x-coordinate of the blob endpoints.
 ** maxX: Maximum x-coordinate of the blob endpoints.
 ** minY: Minimum y-coordinate of the blob endpoints.
 ** maxY: Maximum y-coordinate of the blob endpoints.
 ** rangeX: Range of x-coordinates (maxX - minX).
 ** rangeY: Range of y-coordinates (maxY - minY).
 ** standardDeviationX: Standard deviation of x-coordinates.
 ** standardDeviationY: Standard deviation of y-coordinates.
 ** count: Total number of blob endpoints processed.
 */
function calculateBlobData(blobs) {
    if (blobs.length === 0) {
        return {
            averageX: 0,
            averageY: 0,
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity,
            rangeX: 0,
            rangeY: 0,
            standardDeviationX: 0,
            standardDeviationY: 0,
            count: 0
        };
    }

    const allXValues = [];
    const allYValues = [];

    for (const blob of blobs) {
        const xValue = distance(blob.line1.x1, blob.line1.y1, blob.line1.x2, blob.line1.y2);
        const yValue = distance(blob.line2.x1, blob.line2.y1, blob.line2.x2, blob.line2.y2);
        const activeCalibration = localStorage.getItem('activeCalibration');
        if (activeCalibration) {
            const calibration = calibrations.find(cal => cal.name === activeCalibration);
            if (calibration) {
                const pxPerMicron = calibration.value;
                allXValues.push(xValue / pxPerMicron);
                allYValues.push(yValue / pxPerMicron);
            }
        } else {
            allXValues.push(xValue);
            allYValues.push(yValue);
        }
    }

    const count = allXValues.length;

    const sumX = allXValues.reduce((a, b) => a + b, 0);
    const sumY = allYValues.reduce((a, b) => a + b, 0);
    const averageX = sumX / count;
    const averageY = sumY / count;

    const minX = Math.min(...allXValues);
    const maxX = Math.max(...allXValues);
    const minY = Math.min(...allYValues);
    const maxY = Math.max(...allYValues);
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    const varianceX = allXValues.reduce((acc, val) => acc + Math.pow(val - averageX, 2), 0) / count;
    const varianceY = allYValues.reduce((acc, val) => acc + Math.pow(val - averageY, 2), 0) / count;
    const standardDeviationX = Math.sqrt(varianceX);
    const standardDeviationY = Math.sqrt(varianceY);

    return {
        averageX: averageX.toFixed(2),
        averageY: averageY.toFixed(2),
        minX: minX.toFixed(2),
        maxX: maxX.toFixed(2),
        minY: minY.toFixed(2),
        maxY: maxY.toFixed(2),
        rangeX: rangeX.toFixed(2),
        rangeY: rangeY.toFixed(2),
        standardDeviationX: standardDeviationX.toFixed(2),
        standardDeviationY: standardDeviationY.toFixed(2),
        count: count
    };
}

/**
 * Sets up the canvas for zooming, panning, and drawing interactions.
 */
function loadCanvas() {
    const ctx = canvas.getContext('2d');
    trackTransforms(ctx); // Enable zoom and pan
    redraw(ctx); // Initial redraw

    let lastX = canvas.width / 2;
    let lastY = canvas.height / 2;
    let dragStart = null;
    let dragged = false;
    const scaleFactor = 1.1;

    // Load and populate the calibrations from local storage.
    // If no calibrations are found, initialize an empty array.
    const storedCalibrations = localStorage.getItem('calibrations');
    if (storedCalibrations) {
        const parsedCalibrations = JSON.parse(storedCalibrations);
        calibrations.push(...parsedCalibrations);
    } else {
        localStorage.setItem('calibrations', JSON.stringify(calibrations));
    }
    // Update the drop down
    const calibrationSelect = document.getElementById('calibrationSelect');
    calibrations.forEach(calibration => {
        const option = document.createElement('option');
        option.value = calibration.name;
        option.textContent = `${calibration.name} (${calibration.value} px/µm)`;
        calibrationSelect.appendChild(option);
    });
    // If local storage contains the value 'activeCalibration', set the selected option in the dropdown to that value.
    const activeCalibration = localStorage.getItem('activeCalibration');
    if (activeCalibration) {
        const optionToSelect = Array.from(calibrationSelect.options).find(option => option.value === activeCalibration);
        if (optionToSelect) {
            optionToSelect.selected = true;
            const ctx = canvas.getContext('2d');
            redraw(ctx);
        }
    }
    // Add an event listener to update the active calibration in local storage when the dropdown value changes.
    calibrationSelect.addEventListener('change', () => {
        const selectedCalibration = calibrationSelect.value;
        // If the selected calibration is item 0, clear the active calibration in local storage.
        if (selectedCalibration === '0') {
            localStorage.removeItem('activeCalibration');
        } else {
            localStorage.setItem('activeCalibration', selectedCalibration);
        }
        // Redraw the canvas to reflect the new calibration.
        const ctx = canvas.getContext('2d');
        redraw(ctx);
    });

    // Set the color of the color inputs to the current values in local storage.
    const storedCanvasColor = localStorage.getItem('canvasColor') || '#ffffff';
    const storedBarColor = localStorage.getItem('barColor') || '#000000';
    const canvasColorInput = document.getElementById('canvasColor');
    const barColorInput = document.getElementById('barColor');
    canvasColorInput.value = storedCanvasColor;
    barColorInput.value = storedBarColor;

    /**
     * Handles the mousedown event for enabling panning.
     * Records the starting position of the drag.
     * @param {MouseEvent} evt - The mousedown event object.
     */
    canvas.addEventListener('mousedown', (evt) => {
        document.body.style.userSelect = 'none';
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragStart = ctx.transformedPoint(lastX, lastY);
        dragged = false;
    }, false);

    /**
     * Handles the mousemove event for panning the canvas or drawing the current line.
     * Updates the canvas transformation during panning or the end point of the line being drawn.
     * @param {MouseEvent} evt - The mousemove event object.
     */
    canvas.addEventListener('mousemove', (evt) => {
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragged = true;
        if (dragStart) {
            // Panning logic
            const pt = ctx.transformedPoint(lastX, lastY);
            ctx.translate(pt.x - dragStart.x, pt.y - dragStart.y);
            redraw(ctx);
        } else if (points.length % 2 === 1) {
            // Drawing the second point of a line
            const rect = canvas.getBoundingClientRect();
            const mouseX = evt.clientX - rect.left;
            const mouseY = evt.clientY - rect.top;
            const pt = ctx.transformedPoint(mouseX, mouseY);

            // Adjust the second point of the second line to be perpendicular to the first line
            if (lines.length === 2) {
                const line = lines[0];

                // Ensure p1 has the lower y-value for consistent perpendicular calculation
                const p1 = { x: line.x1, y: line.y1 };
                const p2 = { x: line.x2, y: line.y2 };
                if (p1.y > p2.y) {
                    [p1.x, p2.x] = [p2.x, p1.x];
                    [p1.y, p2.y] = [p2.y, p1.y];
                }
                lines[0].x1 = p1.x;
                lines[0].x2 = p2.x;
                lines[0].y1 = p1.y;
                lines[0].y2 = p2.y;

                const dy = line.y2 - line.y1;
                const dx = line.x2 - line.x1;
                const m = dy / dx; // slope of line 0
                const b = line.y1 - m * line.x1; // y-intercept of line 0
                const side = (dy * points[2].x) - (dx * points[2].y) + b;
                const angle = Math.atan2(dy, dx) + Math.PI / 2.0; // perpendicular angle
                const magnitude = Math.sqrt(Math.pow(pt.x - lines[1].x1, 2) + Math.pow(pt.y - lines[1].y1, 2));
                const offsetX = Math.cos(angle) * magnitude;
                const offsetY = Math.sin(angle) * magnitude;

                // Adjust the perpendicular line's end point based on the side of the third point
                if (side > 0) {
                    if (pt.x > lines[1].x1) {
                        pt.x = lines[1].x1 - offsetX;
                        pt.y = lines[1].y1 - offsetY;
                    }
                    else {
                        pt.x = lines[1].x1 + offsetX;
                        pt.y = lines[1].y1 + offsetY;
                    }
                } else {
                    if (pt.y > lines[1].y1) {
                        pt.x = lines[1].x1 + offsetX;
                        pt.y = lines[1].y1 + offsetY;
                    }
                    else {
                        pt.x = lines[1].x1 - offsetX;
                        pt.y = lines[1].y1 - offsetY;
                    }
                }
            }

            // Update the current line's end point
            lines[lines.length - 1].x2 = pt.x;
            lines[lines.length - 1].y2 = pt.y;
            redraw(ctx);
        }
    }, false);

    /**
     * Handles the mouseup event to stop panning.
     * Clears the drag start point.
     * @param {MouseEvent} evt - The mouseup event object.
     */
    canvas.addEventListener('mouseup', () => {
        dragStart = null;
    }, false);

    /**
     * Handles the mousewheel event for zooming the canvas.
     * Adjusts the scale of the canvas based on the scroll delta.
     * @param {WheelEvent} evt - The mousewheel event object.
     */
    const handleScroll = (evt) => {
        // Limit the zoom to a range of 0.1 to 10
        const scaleFactor = 1.1;
        const minScale = 0.1;
        const maxScale = 10;
        const currentScale = ctx.getTransform().a; // Get the current scale factor
        const newScale = currentScale * Math.pow(scaleFactor, evt.deltaY > 0 ? -1 : 1);
        if ((newScale < minScale && evt.deltaY > 0) || (newScale > maxScale && evt.deltaY < 0)) {
            evt.preventDefault();
            return false; // Prevent zooming out too much or in too much
        }

        const delta = evt.wheelDelta ? evt.wheelDelta / 40 : evt.detail ? -evt.detail : 0;
        if (delta) {
            const pt = ctx.transformedPoint(lastX, lastY);
            ctx.translate(pt.x, pt.y);
            const factor = Math.pow(scaleFactor, delta);
            ctx.scale(factor, factor);
            ctx.translate(-pt.x, -pt.y);
            redraw(ctx);
        }
        evt.preventDefault();
        return false;
    };

    canvas.addEventListener('DOMMouseScroll', handleScroll, false); // Firefox
    canvas.addEventListener('mousewheel', handleScroll, false);     // Others

    /**
     * Handles the click event for adding new points and lines.
     * Adds a new point at the clicked location and creates lines between consecutive points.
     * Also handles the logic for creating blobs (pairs of perpendicular lines).
     * @param {MouseEvent} evt - The click event object.
     */
    canvas.addEventListener('click', (evt) => {
        if (!dragged) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = evt.clientX - rect.left;
            const mouseY = evt.clientY - rect.top;
            const pt = ctx.transformedPoint(mouseX, mouseY);

            // Validation for the third point to be between perpendiculars of the first line
            if (points.length === 2) {
                const perpendicular = isPointBetweenPerpendiculars([pt.x, pt.y], [lines[0].x1, lines[0].y1], [lines[0].x2, lines[0].y2]);
                if (!perpendicular) {
                    console.log("Point is not between perpendiculars of the first line.");
                    return;
                }
            }

            // Validation for the fourth point to create intersecting lines
            if (points.length === 3) {
                const intersection = lineSegmentIntersection(
                    { x: lines[0].x1, y: lines[0].y1 },
                    { x: lines[0].x2, y: lines[0].y2 },
                    { x: lines[1].x1, y: lines[1].y1 },
                    { x: pt.x, y: pt.y } // Use the current click as the end of the second line
                );
                if (!intersection.intersect) {
                    console.log("The second line does not intersect the first line.");
                    return;
                }
            }

            points.push({ x: pt.x, y: pt.y, idx: points.length });

            // Start a new line if it's the first point of a pair
            if (points.length % 2 === 1) {
                lines.push({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
            }

            // Create a blob when the fourth point is added
            if (points.length === 4) {
                // lines[0] should be longer than lines[1], swap them if this is not true
                const d1 = distance(lines[0].x1, lines[0].y1, lines[0].x2, lines[0].y2);
                const d2 = distance(lines[1].x1, lines[1].y1, lines[1].x2, lines[1].y2);
                if (d2 > d1) {
                    lines.push(lines[0]);
                    lines.shift();
                }
                blobs.push({ line1: lines[0], line2: lines[1] });
                lines.length = 0;
                points.length = 0;
            }

            // If in scale mode, prompt the user for text entry after the second point
            if (points.length === 2 && isCalibrationMode()) {
                let measurement = 0;
                while (true) {
                    measurement = prompt("Enter the true measurment for this segment (Units = µm)", "");
                    if (measurement && isNaN(measurement)) {
                        alert("Please enter a valid number for the measurement.");
                    } else {
                        break;
                    }
                }

                if (measurement) {
                    while (true) {
                        const calibration = prompt("Enter the name for this calibration", "");
                        if (calibration && calibration.length > 0) {
                            // Check if the calibration name already exists
                            const existingCalibrations = JSON.parse(localStorage.getItem('calibrations')) || [];
                            const calibrationExists = existingCalibrations.some(cal => cal.name === calibration);
                            if (calibrationExists) {
                                // Ask user if they want to overwrite the existing calibration
                                const overwrite = confirm(`The calibration name "${calibration}" already exists. Do you want to overwrite it?`);
                                if (overwrite) {
                                    // Remove the existing calibration
                                    const index = calibrations.findIndex(cal => cal.name === calibration);
                                    if (index !== -1) {
                                        calibrations.splice(index, 1);
                                    }
                                } else {
                                    // If user chooses not to overwrite, prompt for a new name
                                    continue;
                                }
                            }

                            // Calculate the px/µm ratio
                            const lineLength = distance(lines[0].x1, lines[0].y1, lines[0].x2, lines[0].y2);
                            const trueLength = parseFloat(measurement);
                            const rawPxPerMicron = lineLength / trueLength;
                            const pxPerMicron = Math.round(rawPxPerMicron * 1000) / 1000; // Round to 3 decimal places
                            const calibrationData = { name: calibration, value: pxPerMicron };
                            calibrations.push(calibrationData);
                            localStorage.setItem('calibrations', JSON.stringify(calibrations));
                            alert(`${calibrationData.name} calibration added: ${calibrationData.value} px/µm`);

                            // Repopulate the dropdown with all the calibrations
                            calibrationSelect.innerHTML = ''; // Clear existing options
                            const defaultOption = document.createElement('option');
                            defaultOption.value = '0';
                            defaultOption.textContent = 'no calibration';
                            calibrationSelect.appendChild(defaultOption);
                            calibrations.forEach(calibration => {
                                const option = document.createElement('option');
                                option.value = calibration.name;
                                option.textContent = `${calibration.name} (${calibration.value} px/µm)`;
                                calibrationSelect.appendChild(option);
                            });

                            // Set the new calibration as the active calibration
                            localStorage.setItem('activeCalibration', calibrationData.name);
                            const selectedOption = Array.from(calibrationSelect.options).find(option => option.value === calibrationData.name);
                            if (selectedOption) {
                                selectedOption.selected = true;
                            }

                            // Enter spore mode
                            const sporeMode = document.getElementById('sporeMode');
                            sporeMode.click();

                            // Redraw the canvas to reflect the new calibration
                            const ctx = canvas.getContext('2d');
                            redraw(ctx);
                            break;
                        } else {
                            break; // Exit if no name is provided
                        }
                    }
                }

                // Clear the calibration points
                points.length = 0;
                lines.length = 0;
            }

            redraw(ctx);

            const message = JSON.stringify({ x: pt.x, y: pt.y });
            console.log(message);
        }
        dragged = false;
    }, false);

    /**
     * Handles the right-click event for clearing points, lines, and blobs.
     * @param {MouseEvent} evt - The contextmenu event object.
     */
    canvas.addEventListener('contextmenu', (evt) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = evt.clientX - rect.left;
        const mouseY = evt.clientY - rect.top;
        const pt = ctx.transformedPoint(mouseX, mouseY);

        // If points.length > 2 remove only the points beyond the first two and delete lines[1]
        if (points.length > 2) {
            evt.preventDefault();
            points.splice(2);
            lines.splice(1, 1);
        } else if (points.length > 0) { // If there are less then 3 points, clear all points and lines
            evt.preventDefault();
            points.length = 0;
            lines.length = 0;
        }

        // Check if the click is within any blob's diamond shape and remove the blob if it is
        for (let i = blobs.length - 1; i >= 0; i--) {
            if (isPointBetweenPerpendiculars([pt.x, pt.y], [blobs[i].line1.x1, blobs[i].line1.y1], [blobs[i].line1.x2, blobs[i].line1.y2]) &&
                isPointBetweenPerpendiculars([pt.x, pt.y], [blobs[i].line2.x1, blobs[i].line2.y1], [blobs[i].line2.x2, blobs[i].line2.y2])) {
                evt.preventDefault();
                blobs.splice(i, 1);
            }
        }

        redraw(ctx);
    }, false);
}

/**
 * Enables zooming and panning functionality on the canvas.
 * It overrides the canvas context's transformation methods to keep track
 * of the current transformation matrix.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
function trackTransforms(ctx) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    let xform = svg.createSVGMatrix();
    ctx.getTransform = () => xform;

    const savedTransforms = [];
    const save = ctx.save;
    ctx.save = function () {
        savedTransforms.push(xform.translate(0, 0));
        return save.call(ctx);
    };

    const restore = ctx.restore;
    ctx.restore = function () {
        xform = savedTransforms.pop();
        return restore.call(ctx);
    };

    const scale = ctx.scale;
    ctx.scale = function (sx, sy) {
        xform = xform.scaleNonUniform(sx, sy);
        return scale.call(ctx, sx, sy);
    };

    const rotate = ctx.rotate;
    ctx.rotate = function (radians) {
        xform = xform.rotate(radians * 180 / Math.PI);
        return rotate.call(ctx, radians);
    };

    const translate = ctx.translate;
    ctx.translate = function (dx, dy) {
        xform = xform.translate(dx, dy);
        return translate.call(ctx, dx, dy);
    };

    const transform = ctx.transform;
    ctx.transform = function (a, b, c, d, e, f) {
        const m2 = svg.createSVGMatrix();
        m2.a = a; m2.b = b; m2.c = c; m2.d = d; m2.e = e; m2.f = f;
        xform = xform.multiply(m2);
        return transform.call(ctx, a, b, c, d, e, f);
    };

    const setTransform = ctx.setTransform;
    ctx.setTransform = function (a, b, c, d, e, f) {
        xform.a = a;
        xform.b = b;
        xform.c = c;
        xform.d = d;
        xform.e = e;
        xform.f = f;
        return setTransform.call(ctx, a, b, c, d, e, f);
    };

    const pt = svg.createSVGPoint();
    const scaleX = canvas.width / gkhead.width;
    const scaleY = canvas.height / gkhead.height;
    ctx.setTransform(Math.min(scaleX, scaleY),
        0,
        0,
        Math.min(scaleX, scaleY),
        (canvas.width - gkhead.width * Math.min(scaleX, scaleY)) / 2,
        (canvas.height - gkhead.height * Math.min(scaleX, scaleY)) / 2);
    ctx.transformedPoint = function (x, y) {
        pt.x = x; pt.y = y;
        return pt.matrixTransform(xform.inverse());
    };
}

/**
 * Executes once the DOM is fully loaded.
 * Sets up event listeners for mobile detection, mode toggling, and image loading.
 */
document.addEventListener('DOMContentLoaded', function () {
    /**
     * Checks if the user agent indicates a mobile or tablet device.
     * @returns {boolean} - True if the device is mobile, false otherwise.
     */
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Alert users on mobile devices about potential issues
    if (isMobile) {
        alert("This website is designed for use with a mouse and desktop and may not work correctly on your device.");
    }

    // Get references to DOM elements
    const sporeMode = document.getElementById('sporeMode');
    const scaleMode = document.getElementById('scaleMode');
    const openImageButton = document.getElementById('openImage');
    const imageInput = document.getElementById('imageInput');
    const uploadButton = document.getElementById('upload');
    const uploadInput = document.getElementById('uploadInput');
    const downloadButton = document.getElementById('download');
    const resetButton = document.getElementById('reset');
    const canvasColor = document.getElementById('canvasColor');
    const barColor = document.getElementById('barColor');
    const detectBlobsButton = document.getElementById('detectBlobs');
    const addImageButton = document.getElementById('addImage');
    const secondaryImageInput = document.getElementById('secondaryImageInput');
    const addNoteButton = document.getElementById('addNote');
    const clearNotesButton = document.getElementById('clearNotes');

    /**
     * Event listener for the 'sporeMode' button.
     * Updates the visual state of the mode buttons.
     */
    sporeMode.addEventListener('click', function () {
        sporeMode.classList.remove('spore-mode-off');
        sporeMode.classList.add('spore-mode-on');
        scaleMode.classList.remove('scale-mode-on');
        scaleMode.classList.add('scale-mode-off');
    });

    /**
     * Event listener for the 'scaleMode' button.
     * Updates the visual state of the mode buttons.
     */
    scaleMode.addEventListener('click', function () {
        sporeMode.classList.remove('spore-mode-on');
        sporeMode.classList.add('spore-mode-off');
        scaleMode.classList.remove('scale-mode-off');
        scaleMode.classList.add('scale-mode-on');

        // Clear points and lines when switching to scale mode
        points.length = 0;
        lines.length = 0;
        const ctx = canvas.getContext('2d');
        redraw(ctx);
    });

    /**
     * Event listener for the 'openImage' button.
     * Triggers the hidden file input element when clicked.
     */
    openImageButton.addEventListener('click', () => {
        imageInput.click(); // Programmatically click the file input
    });

    /**
     * Event listener for changes to the image input element.
     * Reads the selected image file and sets it as the source for the gkhead image.
     * @param {Event} event - The change event object.
     */
    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        document.title = file.name;
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                gkhead.src = e.target.result; // Set the image source to the data URL
            };
            reader.readAsDataURL(file); // Read the file as a data URL
        }
    });

    /** Event listener for the 'upload' button.
     * Prompts the user to select a file and reads its contents.
     * Parses the JSON data and updates the calibrations array and local storage.
     * @param {Event} event - The click event object.
     */
    uploadButton.addEventListener('click', () => {
        uploadInput.click(); // Programmatically click the file input
    });

    /**
     * Event listener for changes to the upload input element.
     * Reads the selected file and updates the calibrations array and local storage.
     * @param {Event} event - The change event object.
     * */
    uploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (Array.isArray(data)) {
                        calibrations.length = 0; // Clear existing calibrations
                        calibrations.push(...data); // Add new calibrations
                        localStorage.setItem('calibrations', JSON.stringify(calibrations)); // Update local storage
                        alert("Calibrations uploaded successfully.");

                        // Update the dropdown with the new calibrations
                        const calibrationSelect = document.getElementById('calibrationSelect');
                        calibrations.forEach(calibration => {
                            const option = document.createElement('option');
                            option.value = calibration.name;
                            option.textContent = `${calibration.name} (${calibration.value} px/µm)`;
                            calibrationSelect.appendChild(option);
                        });
                    } else {
                        alert("Invalid file format. Please upload a valid JSON file.");
                    }
                } catch (error) {
                    alert("Error reading file: " + error.message);
                }
            };
            reader.readAsText(file); // Read the file as text
        }
    });

    /** Event listener for the 'download' button.
     * Creates a JSON file from the calibrations array and triggers a download.
     * @param {Event} event - The click event object.
     * */
    downloadButton.addEventListener('click', () => {
        const dataStr = JSON.stringify(calibrations, null, 2); // Convert calibrations to JSON string
        const blob = new Blob([dataStr], { type: 'application/json' }); // Create a Blob from the JSON string
        const url = URL.createObjectURL(blob); // Create a URL for the Blob

        const a = document.createElement('a'); // Create an anchor element
        a.href = url; // Set the href to the Blob URL
        a.download = 'calibrations.json'; // Set the download attribute with a filename
        document.body.appendChild(a); // Append the anchor to the body
        a.click(); // Programmatically click the anchor to trigger the download
        document.body.removeChild(a); // Remove the anchor from the DOM
    });

    /** Event listener for the 'reset' button.
     * Alerts the user to confirm clearing local storage and all points, lines, and blobs.
     * Clears the local storage and resets the canvas state.
     * @param {Event} event - The click event object.
     */
    resetButton.addEventListener('click', () => {
        const confirmReset = confirm("Are you sure you want to clear all calibrations and drawing elements? This action cannot be undone.");
        if (confirmReset) {
            localStorage.removeItem('calibrations');
            localStorage.removeItem('activeCalibration');
            localStorage.removeItem('canvasColor');
            localStorage.removeItem('barColor');
            localStorage.removeItem('visited');
            localStorage.removeItem('notes');
            location.reload();
        }
    });

    /** Event listener for the 'canvasColor' input element.
     * Updates the canvas background color based on the selected value.
     * @param {Event} event - The input event object.
     * */
    canvasColor.addEventListener('input', (event) => {
        const color = event.target.value;
        localStorage.setItem('canvasColor', color);
        canvas.style.backgroundColor = color;
        const ctx = canvas.getContext('2d');
        redraw(ctx);
    });

    /** Event listener for the 'barColor' input element.
     * Updates the scale bar color based on the selected value.
     * @param {Event} event - The input event object.
     * */
    barColor.addEventListener('input', (event) => {
        const color = event.target.value;
        localStorage.setItem('barColor', color);
        const ctx = canvas.getContext('2d');
        redraw(ctx);
    });

    /** Event listener for the 'detectBlobs' button.
     * Uses OpenCV to detect blobs in the image and draws them on the canvas.
     * @param {Event} event - The click event object.
     */
    detectBlobsButton.addEventListener('click', () => {
        if (opencvInitialized) {
            // Clear existing blobs
            blobs.length = 0;

            // Create temporary canvas to process the image with OpenCV
            const temp_canvas = document.createElement('canvas');
            temp_canvas.width = gkhead.width;
            temp_canvas.height = gkhead.height;
            const temp_ctx = temp_canvas.getContext('2d');
            temp_ctx.drawImage(gkhead, 0, 0);
            const src = cv.imread(temp_canvas);
            const dst = new cv.Mat();
            cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0); // Convert the image to grayscale
            cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT); // Apply Gaussian blur to the image
            cv.threshold(dst, dst, 150, 255, cv.THRESH_BINARY); // Apply binary thresholding to the image
            cv.dilate(dst, dst, new cv.Mat(), new cv.Point(-1, -1), 2, 1, new cv.Scalar(0));
            // Detect contours in the image
            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(dst, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
            for (let i = 0; i < contours.size(); ++i) {
                // Filter contours based on area
                const area = cv.contourArea(contours.get(i));
                if (area < 0.0001 * gkhead.width * gkhead.height || area > 0.8 * gkhead.width * gkhead.height) continue;
                // Filter contours based on circularity
                const perimeter = cv.arcLength(contours.get(i), true);
                const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
                if (circularity < 0.75) continue; // Skip non-circular contours
                // Find the largest distance bewtween the points in the contour
                const points = contours.get(i).data32S;
                let maxDistance = 0;
                let p1 = null;
                let p2 = null;
                for (let j = 0; j < points.length; j += 2) {
                    for (let k = j + 2; k < points.length; k += 2) {
                        const distance = Math.sqrt(Math.pow(points[j] - points[k], 2) + Math.pow(points[j + 1] - points[k + 1], 2));
                        if (distance > maxDistance) {
                            maxDistance = distance;
                            p1 = [points[j], points[j + 1]];
                            p2 = [points[k], points[k + 1]];
                        }
                    }
                }
                // Find the longest line segment approximately perpendicular to p1-p2
                let maxPerpendicularDistance = 0;
                let perpendicularP1 = null;
                let perpendicularP2 = null;

                for (let j = 0; j < points.length; j += 2) {
                    const point1 = { x: points[j], y: points[j + 1] };
                    for (let k = j + 2; k < points.length; k += 2) {
                        const point2 = { x: points[k], y: points[k + 1] };
                        // Calculate the slope of the line p1-p2
                        const dx = p2[0] - p1[0];
                        const dy = p2[1] - p1[1];
                        const lineAngle = Math.atan2(dy, dx);
                        // Calculate the slope of the line point1-point2
                        const dx2 = point2.x - point1.x;
                        const dy2 = point2.y - point1.y;
                        const segmentAngle = Math.atan2(dy2, dx2);
                        // Calculate the angle difference
                        let angleDifference = Math.abs(lineAngle - segmentAngle);
                        angleDifference = Math.min(angleDifference, Math.abs(Math.PI - angleDifference)); // Normalize to [0, π/2]
                        // Check if the angle difference is within 15 degrees (~0.2618 radians)
                        if (Math.abs(angleDifference - Math.PI / 2) <= 0.2618) {
                            const distance = Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
                            if (distance > maxPerpendicularDistance) {
                                maxPerpendicularDistance = distance;
                                perpendicularP1 = [point1.x, point1.y];
                                const angle = lineAngle + Math.PI / 2; // Perpendicular angle
                                const offsetX = Math.cos(angle) * distance * 0.95;
                                const offsetY = Math.sin(angle) * distance * 0.95;
                                // Ensure p1 has the lower y-value for consistent calculations
                                if (p1[1] > p2[1] || (p1[1] === p2[1] && p1[0] > p2[0])) {
                                    [p1, p2] = [p2, p1];
                                }
                                // Update perpendicularP2 based on the side of the line
                                const side = (dy * point1.x - dx * point1.y + p1[1] * p2[0] - p1[0] * p2[1]);
                                if (side > 0) {
                                    perpendicularP2 = [point1.x + offsetX, point1.y + offsetY];
                                } else {
                                    perpendicularP2 = [point1.x - offsetX, point1.y - offsetY];
                                }
                            }
                        }
                    }
                }
                if (!perpendicularP1 || !perpendicularP2) continue; // Skip if no perpendicular line is found

                blobs.push({
                    line1: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
                    line2: { x1: perpendicularP1[0], y1: perpendicularP1[1], x2: perpendicularP2[0], y2: perpendicularP2[1] }
                });
            }

            // Breaks opening of images (Use for debugging OpenCV)
            // Draw the detected blobs on the main canvas
            // temp_ctx.drawImage(temp_canvas, 0, 0);
            // cv.imshow(temp_canvas, dst);

            // Free resources
            src.delete();
            dst.delete();
            temp_canvas.remove();
            contours.delete(); // Delete the contours MatVector
            hierarchy.delete(); // Delete the hierarchy Mat

            // Breaks opening of images (Use for debugging OpenCV)
            // Update image
            //gkhead = temp_canvas;

            // Redraw the canvas with the detected blobs
            const ctx = canvas.getContext('2d');
            redraw(ctx);
        } else {
            alert("OpenCV is not initialized yet. Please try again.");
        }
    });

    /**
     * Event listener for the 'addImage' button.
     * Triggers the hidden file input element when clicked.
     */
    addImageButton.addEventListener('click', () => {
        secondaryImageInput.click(); // Programmatically click the file input
    });

    /**
     * Event listener for changes to the image input element.
     * Reads the selected image file and sets it as the source for the secondary image.
     * @param {Event} event - The change event object.
     */
    secondaryImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                gkhead2.src = e.target.result; // Set the image source to the data URL
            };
            reader.readAsDataURL(file); // Read the file as a data URL
        } else {
            gkhead2.src = ""; // Clear the image source if no file is selected
            const ctx = canvas.getContext('2d');
            redraw(ctx);
        }
    });

    /** Event listener for the 'addNote' button.
     * Opens an input dialog to enter a note and adds it to a list in local storage.
     * @param {Event} event - The click event object.
     */
    addNoteButton.addEventListener('click', (event) => {
        const note = prompt("Enter note:", "");
        if (note) {
            const notes = JSON.parse(localStorage.getItem('notes')) || [];
            notes.push(note);
            localStorage.setItem('notes', JSON.stringify(notes));
            const ctx = canvas.getContext('2d');
            redraw(ctx);
        }
    });

    /** Event listener for the 'clearNotes' button.
     * Clears all notes from local storage and the displayed list.
     * @param {Event} event - The click event object.
     */
    clearNotesButton.addEventListener('click', () => {
        localStorage.removeItem('notes');
        const ctx = canvas.getContext('2d');
        redraw(ctx);
    });

    /**
     * Event listener for when the gkhead image has loaded.
     * Scales and centers the image on the canvas and triggers the initial redraw.
     */
    gkhead.onload = function () {
        const ctx = canvas.getContext('2d');
        const scaleX = canvas.width / gkhead.width;
        const scaleY = canvas.height / gkhead.height;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (canvas.width - gkhead.width * scale) / 2;
        const offsetY = (canvas.height - gkhead.height * scale) / 2;

        ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

        // If this is a user-uploaded image, redraw and clear the canvas
        if (!gkhead.src.endsWith(initialImage)) {
            points.length = 0;
            lines.length = 0;
            blobs.length = 0;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            redraw(ctx);
        }
    };

    /**
     * Event listener for when the gkhead2 image has loaded.
     * Triggers redraw to display the image on the canvas.
     */
    gkhead2.onload = function () {
        const ctx = canvas.getContext('2d');
        redraw(ctx);
    };


    /**
     * Event listener for errors during the loading of the gkhead image.
     * Logs an error message to the console.
     */
    gkhead.onerror = function () {
        console.error("Failed to load image.");
    };

    /**
     * Event listener for errors during the loading of the gkhead image.
     * Logs an error message to the console.
     */
    gkhead2.onerror = function () {
        console.error("Failed to load image.");
    };
});

var Module = {
    // https://emscripten.org/docs/api_reference/module.html#Module.onRuntimeInitialized
    onRuntimeInitialized() {
        opencvInitialized = true;
    }
};

window.onload = loadCanvas;

gkhead.src = initialImage; // Set the initial image source
