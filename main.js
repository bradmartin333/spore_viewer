// Initialize canvas and image
const canvas = document.getElementById('image-canvas');
canvas.width = 800;
canvas.height = 600;

const gkhead = new Image();

// Array to store drawn points
const points = [];
const lines = [];
const blobs = [];

/**
 * Redraws the canvas with the current image, transformations, and points.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
function redraw(ctx) {
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
     * Adjusts the label position if it overlaps with existing lines or other labels.
     * @param {number} x - The initial x-coordinate of the label.
     * @param {number} y - The initial y-coordinate of the label.
     * @param {object} line - The line object {x1, y1, x2, y2}.
     * @param {number} labelWidth - The width of the label text.
     * @returns {object} - The adjusted x and y coordinates of the label.
     */
    function adjustLabelPosition(x, y, line, labelWidth) {
        const buffer = 10; // Buffer space from the line ends and other labels
        let newX = x, newY = y;

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
     * Clears the canvas area for redrawing.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     */

    const p1 = ctx.transformedPoint(0, 0);
    const p2 = ctx.transformedPoint(canvas.width, canvas.height);
    ctx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

    ctx.save();
    const scaleX = canvas.width / gkhead.width;
    const scaleY = canvas.height / gkhead.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - gkhead.width * scale) / 2;
    const offsetY = (canvas.height - gkhead.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.drawImage(gkhead, 0, 0);
    ctx.save();

    blobs.forEach(blob => {
        ctx.beginPath();
        ctx.moveTo(blob.line1.x1, blob.line1.y1);
        ctx.lineTo(blob.line1.x2, blob.line1.y2);
        ctx.strokeStyle = 'purple';
        ctx.lineWidth = 2 / ctx.getTransform().a;
        ctx.stroke();
        ctx.closePath();
        ctx.beginPath();
        ctx.lineTo(blob.line2.x2, blob.line2.y2);
        ctx.lineTo(blob.line2.x1, blob.line2.y1);
        ctx.strokeStyle = 'purple';
        ctx.lineWidth = 2 / ctx.getTransform().a;
        ctx.stroke();
        ctx.closePath();

        // Display line lengths
        const line1Length = distance(blob.line1.x1, blob.line1.y1, blob.line1.x2, blob.line1.y2);
        const line2Length = distance(blob.line2.x1, blob.line2.y1, blob.line2.x2, blob.line2.y2);
        ctx.font = '12px Arial';
        ctx.fillStyle = 'black';

        const textLine1 = `${line1Length.toFixed(2)} px`;
        const textLine2 = `${line2Length.toFixed(2)} px`;
        const textMetricsLine1 = ctx.measureText(textLine1);
        const textMetricsLine2 = ctx.measureText(textLine2);
        const labelWidthLine1 = textMetricsLine1.width;
        const labelWidthLine2 = textMetricsLine2.width;

        // Draw text near endpoints of line1
        const label1Pos = adjustLabelPosition(blob.line1.x2, blob.line1.y2, blob.line1, labelWidthLine1);
        ctx.fillText(textLine1, label1Pos.x, label1Pos.y);

        // Draw text near endpoints of line2
        const label2Pos = adjustLabelPosition(blob.line2.x2, blob.line2.y2, blob.line2, labelWidthLine2);
        ctx.fillText(textLine2, label2Pos.x, label2Pos.y);
    });

    lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 3 / ctx.getTransform().a;
        ctx.stroke();
        ctx.closePath();
    });

    points.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5 / ctx.getTransform().a, 0, 2 * Math.PI); // Adjust size based on current scale
        ctx.fillStyle = point.idx > 1 ? 'green' : 'red';
        ctx.fill();
        ctx.closePath();
    });

    ctx.restore();
}

function lineSegmentIntersection(p1, q1, p2, q2) {
    // Helper function to calculate the orientation of three points (p, q, r).
    // Returns:
    //   0 if the points are collinear.
    //   1 if the points are clockwise.
    //  -1 if the points are counterclockwise.
    function orientation(p, q, r) {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (val === 0) return 0;  // Collinear
        return (val > 0) ? 1 : -1; // Clockwise or counterclockwise
    }

    // Helper function to check if a point 'p' lies on the line segment 'p1q1'.
    function onSegment(p, p1, q1) {
        if (p.x <= Math.max(p1.x, q1.x) && p.x >= Math.min(p1.x, q1.x) &&
            p.y <= Math.max(p1.y, q1.y) && p.y >= Math.min(p1.y, q1.y)) {
            return true;
        }
        return false;
    }

    // 1. Calculate the orientations of the four possible triangles formed by the points.
    const orient1 = orientation(p1, q1, p2);
    const orient2 = orientation(p1, q1, q2);
    const orient3 = orientation(p2, q2, p1);
    const orient4 = orientation(p2, q2, q1);

    // 2. Check for general intersection (when orientations are different).
    if (orient1 !== orient2 && orient3 !== orient4) {
        // 3. Calculate the intersection point.
        // Using the formula derived from solving the parametric equations of the lines:
        // x = x1 + (x2 - x1) * t
        // y = y1 + (y2 - y1) * t
        // where t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) /
        //           ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4))
        const denominator = ((p1.x - q1.x) * (p2.y - q2.y) - (p1.y - q1.y) * (p2.x - q2.x));
        if (denominator === 0) {
            return { intersect: false, point: null }; // Parallel lines, no intersection
        }
        const t = ((p1.x - p2.x) * (p2.y - q2.y) - (p1.y - p2.y) * (p2.x - q2.x)) / denominator;
        const u = -((p1.x - q1.x) * (p1.y - p2.y) - (p1.y - q1.y) * (p1.x - p2.x)) / denominator;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            const intersectionX = p1.x + t * (q1.x - p1.x);
            const intersectionY = p1.y + t * (q1.y - p1.y);
            return { intersect: true, point: { x: intersectionX, y: intersectionY } };
        } else {
            return { intersect: false, point: null }; // Intersection outside the segments
        }
    }

    // 4. Check for special cases (collinear points).
    if (orient1 === 0 && onSegment(p2, p1, q1)) {
        return { intersect: true, point: p2 };
    }
    if (orient2 === 0 && onSegment(q2, p1, q1)) {
        return { intersect: true, point: q2 };
    }
    if (orient3 === 0 && onSegment(p1, p2, q2)) {
        return { intersect: true, point: p1 };
    }
    if (orient4 === 0 && onSegment(q1, p2, q2)) {
        return { intersect: true, point: q1 };
    }

    // 5. If none of the above conditions are met, the line segments do not intersect.
    return { intersect: false, point: null };
}

function isPointBetweenPerpendiculars(point, segmentStart, segmentEnd) {
    // Handle the edge case where the segment is a single point.
    if (segmentStart[0] === segmentEnd[0] && segmentStart[1] === segmentEnd[1]) {
        return true; // Consider the point to be "between"
    }

    // Calculate the vector representing the line segment.
    const segmentVector = [segmentEnd[0] - segmentStart[0], segmentEnd[1] - segmentStart[1]];

    // Calculate the vector from the start point of the segment to the given point.
    const pointToStartVector = [point[0] - segmentStart[0], point[1] - segmentStart[1]];

    // Calculate the dot product of the segment vector and the vector from the start
    // point to the given point.
    const dot1 = segmentVector[0] * pointToStartVector[0] + segmentVector[1] * pointToStartVector[1];

    // Calculate the vector from the end point of the segment to the given point.
    const pointToEndVector = [point[0] - segmentEnd[0], point[1] - segmentEnd[1]];
    // Calculate the dot product of the segment vector and the vector from the end point
    // to the given point.  This is equivalent to dot2.
    const dot2 = segmentVector[0] * pointToEndVector[0] + segmentVector[1] * pointToEndVector[1];
    // The point is between the perpendiculars if the dot products have opposite signs.
    return (dot1 <= 0 && dot2 >= 0) || (dot1 >= 0 && dot2 <= 0);
}

/**
 * Sets up the canvas for zooming, panning, and interaction.
 */
function loadCanvas() {
    const ctx = canvas.getContext('2d');
    trackTransforms(ctx);
    redraw(ctx);

    let lastX = canvas.width / 2, lastY = canvas.height / 2;
    let dragStart, dragged;

    canvas.addEventListener('mousedown', (evt) => {
        document.body.style.userSelect = 'none';
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragStart = ctx.transformedPoint(lastX, lastY);
        dragged = false;
    }, false);

    canvas.addEventListener('mousemove', (evt) => {
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragged = true;
        if (dragStart) {
            const pt = ctx.transformedPoint(lastX, lastY);
            ctx.translate(pt.x - dragStart.x, pt.y - dragStart.y);
            redraw(ctx);
        }
    }, false);

    canvas.addEventListener('mouseup', () => {
        dragStart = null;
    }, false);

    const scaleFactor = 1.1;

    const zoom = (clicks) => {
        const pt = ctx.transformedPoint(lastX, lastY);
        ctx.translate(pt.x, pt.y);
        const factor = Math.pow(scaleFactor, clicks);
        ctx.scale(factor, factor);
        ctx.translate(-pt.x, -pt.y);
        redraw(ctx);
    };

    const handleScroll = (evt) => {
        const delta = evt.wheelDelta ? evt.wheelDelta / 40 : evt.detail ? -evt.detail : 0;
        if (delta) zoom(delta);
        return evt.preventDefault() && false;
    };

    canvas.addEventListener('DOMMouseScroll', handleScroll, false);
    canvas.addEventListener('mousewheel', handleScroll, false);

    canvas.addEventListener('mousemove', (evt) => {
        if (points.length % 2 === 1) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = evt.clientX - rect.left;
            const mouseY = evt.clientY - rect.top;
            const pt = ctx.transformedPoint(mouseX, mouseY);

            // if drawing line index 1, the mouse pt is converted to
            // have a new xy where line index 1 is perpendicular to line index 0
            if (lines.length === 2) {
                const line = lines[0];

                // get p1 and p2 where p1 is the lowest y value point
                // and p2 is the highest y value point
                const p1 = { x: line.x1, y: line.y1 };
                const p2 = { x: line.x2, y: line.y2 };
                if (p1.y > p2.y) {
                    p1.x = line.x2;
                    p1.y = line.y2;
                    p2.x = line.x1;
                    p2.y = line.y1;
                }

                line.x1 = p1.x;
                line.x2 = p2.x;
                line.y1 = p1.y;
                line.y2 = p2.y;

                const dy = line.y2 - line.y1;
                const dx = line.x2 - line.x1;
                const m = dy / dx; // slope of line 0
                const b = line.y1 - m * line.x1; // y-intercept of line 0
                const side = (dy * points[2].x) - (dx * points[2].y) + b;
                const angle = Math.atan2(dy, dx) + Math.PI / 2.0; // perpendicular angle
                const magnitude = Math.sqrt(Math.pow(pt.x - lines[1].x1, 2) + Math.pow(pt.y - lines[1].y1, 2));
                const offsetX = Math.cos(angle) * magnitude;
                const offsetY = Math.sin(angle) * magnitude;

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

            lines[lines.length - 1].x2 = pt.x;
            lines[lines.length - 1].y2 = pt.y;
            redraw(ctx);
        }
    });

    canvas.addEventListener('click', (evt) => {
        if (!dragged) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = evt.clientX - rect.left;
            const mouseY = evt.clientY - rect.top;
            const pt = ctx.transformedPoint(mouseX, mouseY);

            if (points.length === 2) {
                const perpendicular = isPointBetweenPerpendiculars([pt.x, pt.y], [lines[0].x1, lines[0].y1], [lines[0].x2, lines[0].y2]);
                if (!perpendicular) {
                    console.log("point is not between perpendiculars");
                    return;
                }
            }

            if (points.length === 3) {
                const intersection = lineSegmentIntersection(
                    { x: lines[0].x1, y: lines[0].y1 },
                    { x: lines[0].x2, y: lines[0].y2 },
                    { x: lines[1].x1, y: lines[1].y1 },
                    { x: lines[1].x2, y: lines[1].y2 }
                );
                if (!intersection.intersect) {
                    console.log("lines do not intersect");
                    return;
                }
            }

            points.push({ x: pt.x, y: pt.y, idx: points.length });
            if (points.length % 2 === 1) {
                lines.push({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
            }
            if (points.length === 4) {
                blobs.push({ line1: lines[0], line2: lines[1] });
                lines.length = 0;
                points.length = 0;
            }

            redraw(ctx);

            const message = JSON.stringify({ x: pt.x, y: pt.y });
            console.log(message);
        }
        dragged = false;
    });
}

window.onload = loadCanvas;

gkhead.src = "assets/spore_print.jpg";

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
    ctx.transformedPoint = function (x, y) {
        pt.x = x; pt.y = y;
        return pt.matrixTransform(xform.inverse());
    };
}

document.addEventListener('DOMContentLoaded', function () {
    // Check if the user is on a mobile or tablet device
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
        alert("this website is made for use with a mouse and desktop and may not work correctly on your device");
    }

    const sporeMode = document.getElementById('sporeMode');
    const scaleMode = document.getElementById('scaleMode');
    const openImageButton = document.getElementById('openImage');
    const imageInput = document.getElementById('imageInput');

    // Toggle mode logic
    sporeMode.addEventListener('click', function () {
        sporeMode.classList.remove('spore-mode-off');
        sporeMode.classList.add('spore-mode-on');
        scaleMode.classList.remove('scale-mode-on');
        scaleMode.classList.add('scale-mode-off');
    });
    scaleMode.addEventListener('click', function () {
        sporeMode.classList.remove('spore-mode-on');
        sporeMode.classList.add('spore-mode-off');
        scaleMode.classList.remove('scale-mode-off');
        scaleMode.classList.add('scale-mode-on');
    });

    // Open image functionality
    openImageButton.addEventListener('click', () => {
        imageInput.click(); // Trigger the hidden file input
    });

    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                gkhead.src = e.target.result; // Set the image source
            };
            reader.readAsDataURL(file);
        }
    });

    // Load the image onto the canvas
    gkhead.onload = function () {
        const ctx = canvas.getContext('2d');
        const scaleX = canvas.width / gkhead.width;
        const scaleY = canvas.height / gkhead.height;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (canvas.width - gkhead.width * scale) / 2;
        const offsetY = (canvas.height - gkhead.height * scale) / 2;

        ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
        redraw(ctx); // Redraw the canvas with the new image
    };

    gkhead.onerror = function () {
        console.error("Failed to load image.");
    };
});