/*
 * Browser layer
 */

function Panel (cutfold, canvas, show_guidelines, readonly) {

    this.cutfold = cutfold;
    this.canvas = canvas;
    this.caption = document.getElementById ("caption")

    if (show_guidelines) {
        this.guidelines = Guideline.snowflakeGuidelines();
    }
    this.mode = "fold";
    this.help_text = null;
    this.offscreen = null;            // off-screen buffer for double-buffering
    this.offscreen_width=0;
    this.offscreen_height=0;

    // Set up buttons
    if (!readonly) 
    {
        // Set up buttons
        actions = ["clear", "fold", "cut", "discard", "unfold", "undo", "reset", "spin", "help"];
        for (var i = 0; i < actions.length; i++) {
            setup_button (actions[i], this)
        }
        if (this.cutfold.debug) {
            setup_button ("step", this)
            setup_button ("exit", this)
        } else {
            setup_button ("save", this)
        }
        var mt = new MouseTrap (this.cutfold);
        this.mt = mt;
        canvas.onmousedown = function (evt) { mt.handleMouseDown (evt, 1); }
        canvas.onmouseup = function (evt) { mt.handleMouseUp (evt); }
        canvas.ondblclick = function (evt) { mt.handleMouseDown (evt, 2); }
        canvas.onmousemove = function (evt) { mt.handleMouseMove (evt); }
    }
}

function setup_button (action, listener) {
    var btn = document.getElementById (action + "-button");
    if (btn) {
        btn.onclick = function () { listener.on_action(action) };
    } else {
        console.warn ("Attempt to configure nonexistent action button: " + action);
    }
}

Panel.prototype.on_action = function (cmd) {
    // System.out.println (cmd);
    if (cmd == "fold") {
        this.cutfold.reset();
    } else if (cmd == "fold") {
        this.setMode ("fold");
    } else if (cmd == "cut") {
        this.setMode ("cut");
    } else if (cmd == "unfold") {
        this.cutfold.unfold_once ();
        this.setMode ("");
    } else if (cmd == "undo") {
        this.cutfold.undo ();
        this.setMode ("");
        /*
          } else if (cmd == "recenter") {
            app.rescale_canvas ();
            app.mode = "";
            */
    } else if (cmd == "discard") {
        this.setMode ("discard");
        // } else if (cmd == "print") {
        // app.print();
    } else if (cmd == "save") {
        this.cutfold.postURL();
    } else if (cmd == "reset") {
        this.cutfold.reset ();
        this.setMode ("fold");
    } else if (cmd == "spin") {
        this.cutfold.spin ();
        /*
          } else if (cmd == "help") {
          this.show_help ();
        */
    } else if (cmd == "step") {
        this.cutfold.step();
    }
    this.cutfold.repaint ();
}

Panel.prototype.actionPerformed = function (cmd) {
    if (this.cutfold.script != null) {
        if (cmd != "step" && cmd != "exit") {
            // The step command is used to read from the script,
            // so don't write it to the script file!
            this.cutfold.script.captureAction (cmd); // for debugging
        }
    }
    this.runCommand (cmd);
}

Panel.prototype.paint = function () {

    var w = this.canvas.width;
    var h = this.canvas.height;
    var og = this.getOSGraphics(w, h);
    // console.debug ("panel.paint, cutfold.scale=" + this.cutfold.scale);
    og.fillStyle = "#ffffd7";
    og.rect (0, 0, w, h);
    this.drawGrid (og, w, h);
    if (this.cutfold.scale_timer > 0) {
        this.cutfold.tweenModel (og);
    } else {
        this.cutfold.drawModel (og);
    }
    this.drawGuidelines (og, w, h);
    og.fillStyle = "#000";
    og.fillText (this.mode, 10, h - 15);
    if (this.help_text != null) {
        og.fillText (this.help_text, 80, h - 15);
    }
    // draw any selections directly on screen
    if (this.mt != null) {
        this.mt.draw (og);
    }
    // blt the backing buffer -- not in use w/canvas
    this.display (og);
    //console.debug ("panel.paint done");

    // check the consistency of the model data structure and possibly draw
    // some diagnostic information
    if (cutfold.polys != null && 
        this.cutfold.scale_timer == 0 && this.cutfold.tracing) {
        this.cutfold.checkModel (this.cutfold.polys);
    }
}

Panel.prototype.display = function (og) {
    // do nothing -- we are drawing direct to screen
    // og.dispose();
    // g.drawImage(offscreen, 0, 0, null);
}

Panel.prototype.getGraphics = function () {
    return this.canvas.getContext("2d")
}

Panel.prototype.getOSGraphics = function (w, h) {
    /*
    if (offscreen_width != extent.width || offscreen_height != extent.height) {
        offscreen = null;
    }
    if(offscreen == null) {
      	offscreen = createImage(extent.width, extent.height);
        offscreen_width = extent.width;
        offscreen_height = extent.height;
    }
    var og = offscreen.getGraphics();
    og.setColor (new Color(0xffffd7));
    og.fillRect (0, 0, extent.width, extent.height);
    return og;
    */
    return this.canvas.getContext("2d")
}

Panel.prototype.drawGrid = function (g, w, h) {
    var ltblue = "#e7edfb";
    var blue = "#c5d5f5";
    // console.info ("drawGrid ("+w+","+h+")");
    var off = (w/2) % 20;
    for (var i=off; i<w; i += 20) {
        g.strokeStyle = (((i-w/2) % 100 == 0) ? blue : ltblue);
        g.moveTo (i, 0);
        g.lineTo (i, h);
    }
    off = (h/2) % 20;
    for (var i=off; i<h; i += 20) {
        g.strokeStyle = (((i-h/2) % 100 == 0) ? blue : ltblue);
        g.moveTo (0, i);
        g.lineTo (w, i);
    }
    g.stroke()
}

Panel.prototype.drawGuidelines = function (g, w, h) {
    if (this.guidelines != null && this.cutfold.fold_index == this.cutfold.fold_level) 
        // if fold_index == fold_level the user has not yet unfolded
        // and refolded
    {
        var fold_level = this.cutfold.fold_level;
        if (2 * fold_level < this.guidelines.size()) {
            var gl;
            if (this.mode == "fold" || this.mode == "folding") {
                gl = this.guidelines[2 * fold_level];
            } else {
                gl = guidelines[2 * fold_level + 1];
            }
            gl.draw (g, w, h, this.cutfold.xoff, this.cutfold.yoff, this.cutfold.scale);
        }
    }
}

Panel.prototype.enable_undo = function (toggle) {
    var undo_btn = document.getElementById ("undo-button")
    if (undo_btn) {
        undo_btn.disabled = !toggle;
    }
}

Panel.prototype.getCaptionText = function () {
    return this.caption.getText ();
}

Panel.prototype.getMode = function () {
    return this.mode;
}

Panel.prototype.setMode = function (new_mode) {
    this.mode = new_mode;
    this.help_text = null;
    if (new_mode == "discard") {
        this.canvas.style.cursor = "no-drop";
    } else if (new_mode == "confirm fold") {
        this.canvas.style.cursor = "move";
    } else if (new_mode == "cut") {
        this.canvas.style.cursor = "all-scroll";
    } else {
        this.canvas.style.cursor = "default";
    }
    this.show_help ();
}

Panel.prototype.setHelpText = function (ht) {
    this.help_text = ht;
    //repaint ();
}

Panel.prototype.show_help = function () {
    var mode = this.mode
    if (mode == "") {
        this.setHelpText ("Select an action to perform, one of: cut, fold, unfold, discard, undo, spin or save.");
    }
    else if (mode == "fold" || mode == "folding") {
        this.setHelpText ("Click, hold and drag to draw a crease.");
    }
    else if (mode == "cut" || mode == "cutting") {
        this.setHelpText ("Click, release and move.  Repeat at will.  Double-click (or make a closed shape) to finish.");
    }
    else if (mode == "confirm fold") {
        this.setHelpText ("Click on one side of the new crease to fold that side down.");
    }
    else if (mode == "discard") {
        this.setHelpText ("Click on a piece of paper to discard it.");
    }
}


