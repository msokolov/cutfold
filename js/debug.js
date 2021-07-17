/*
  Paper-folding applet
*/

function drawrect() {
    var canvas = document.getElementById("cutfold");
    var context = canvas.getContext("2d");
    context.fillRect(50, 25, 150, 100);    
}

function drawline() {
    var canvas = document.getElementById("cutfold");
    var context = canvas.getContext("2d");
    context.save();
    context.moveTo(0.5, 0.5);
    context.lineTo(100.5, 20.5);
    context.stroke();
    context.globalCompositeOperation = "xor";
    context.moveTo(100.5, 20.5);
    context.lineTo(0.5, 0.5);
    context.stroke();
    context.restore();
}

function fillpoly () {
    var canvas = document.getElementById("cutfold");
    var c2 = canvas.getContext("2d");
    c2.fillStyle = '#f00';
    c2.beginPath();
    c2.moveTo(499, 499);
    c2.lineTo(400,400);
    c2.lineTo(400, 499);
    c2.closePath();
    c2.fill();
}

/* how to put this in an object? 
   make a closure around mousemove
*/
var mx0, my0, mx, my;

function mousedown (evt) {
    var canvas = document.getElementById("cutfold");
    var c2 = canvas.getContext("2d");
    for (foo in evt) {
        console.debug ("event " + foo + "=" + evt[foo]);
    }
    mx0 = mx = evt.clientX - canvas.offsetLeft + 0.5;
    my0 = my = evt.clientY - canvas.offsetTop + 0.5;
    console.debug ("mousedown mx0=" + mx + ", mx=" + mx);
    canvas.onmousemove = mousemove;
    if (false) {
        for (foo in canvas) {
            console.debug ("canvas " + foo + "=" + canvas[foo]);
        }
    }
}

function mousemove (evt) {
    var canvas = document.getElementById("cutfold");
    var c2 = canvas.getContext("2d");
    c2.save();
    c2.globalCompositeOperation = "xor";
    c2.strokeStyle = "#fff";
    c2.moveTo(mx0, my0);
    c2.lineTo(mx, my);
    console.debug ("line1 (" + mx0 + "," + my0 + ") to (" + mx + "," + my + ")");
    mx = evt.clientX - canvas.offsetLeft + 0.5;
    my = evt.clientY - canvas.offsetTop + 0.5;
    c2.moveTo(mx0, my0);
    c2.lineTo(mx, my);
    console.debug ("line2 (" + mx0 + "," + my0 + ") to (" + mx + "," + my + ")");

    c2.stroke();

    c2.restore();
}

function mouseup (evt) {
    var canvas = document.getElementById("cutfold");
    canvas.onmousemove = null;
}

function init () {
    var canvas = document.getElementById("cutfold");
    drawrect();
    drawline();
    fillpoly();
    canvas.onmousedown = mousedown;
    canvas.onmouseup = mouseup;
}

function clear_canvas() {
    var canvas = document.getElementById("cutfold");
    canvas.width = canvas.width;
}

