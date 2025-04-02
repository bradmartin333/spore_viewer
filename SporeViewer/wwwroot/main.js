// Function to send a message to the .NET backend
function callDotNet() {
    window.external.sendMessage('load');
}

// Initialize canvas and image
const canvas = document.getElementById('image-canvas');
canvas.width = 800;
canvas.height = 600;

const gkhead = new Image();

/**
 * Redraws the canvas with the current image and transformations.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
function redraw(ctx) {
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

    canvas.addEventListener('click', (evt) => {
        if (!dragged) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = evt.clientX - rect.left;
            const mouseY = evt.clientY - rect.top;
            const pt = ctx.transformedPoint(mouseX, mouseY);
            const message = JSON.stringify({ x: pt.x, y: pt.y });
            window.external.sendMessage(message);
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

window.external.receiveMessage((message) => {
    gkhead.src = message;

    gkhead.onload = function () {
        const ctx = canvas.getContext('2d');
        const scaleX = canvas.width / gkhead.width;
        const scaleY = canvas.height / gkhead.height;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (canvas.width - gkhead.width * scale) / 2;
        const offsetY = (canvas.height - gkhead.height * scale) / 2;

        ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
        redraw(ctx);
    };

    gkhead.onerror = function () {
        console.error("Failed to load image:", message);
    };
});