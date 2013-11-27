import java.awt.*;
import java.util.Vector;

class CFPanel extends Panel {

    Cutfold cutfold;
    Vector guidelines;
    Actions actions;
    MouseTrap mt;
    Button undo_btn, fold_btn, cut_btn;
    TextField caption;
    String mode;
    String help_text;
    Image offscreen;            // off-screen buffer for double-buffering
    int offscreen_width,offscreen_height;

    CFPanel (Cutfold applet, boolean show_guidelines, boolean readonly) {

        setLayout (null);
        cutfold = applet;

        if (show_guidelines) {
            guidelines = Guideline.snowflakeGuidelines();
        }

        // Set up buttons
        if (!readonly) 
        {
            // Set up buttons
            actions = new Actions (cutfold);

            Button btn = new Button ("fold");
            btn.addActionListener (actions);
            //btn.setToolTipText ("enters folding mode");
            btn.setBounds (5, 5, 85, 18);
            add (fold_btn = btn);

            btn = new Button ("cut");
            btn.addActionListener (actions);
            //btn.setToolTipText ("enters cutting mode");
            btn.setBounds (5, 25, 85, 18);
            add (cut_btn = btn);

            btn = new Button ("discard");
            //btn.setToolTipText ("enters discarding mode");
            btn.addActionListener (actions);
            btn.setBounds (5, 45, 85, 18);
            add (btn);

            btn = new Button ("unfold");
            //btn.setToolTipText ("unfolds the last fold");
            btn.addActionListener (actions);
            btn.setBounds (5, 65, 85, 18);
            add (btn);

            btn = new Button ("undo");
            //btn.setToolTipText ("undoes the last action");
            btn.addActionListener (actions);
            undo_btn = btn;
            btn.setBounds (5, 85, 85, 18);
            add (btn);

            btn = new Button ("reset");
            //btn.setToolTipText ("starts all over again");
            btn.addActionListener (actions);
            btn.setBounds (5, 105, 85, 18);
            add (btn);

            btn = new Button ("spin");
            //btn.setToolTipText ("spins the paper around!");
            btn.addActionListener (actions);
            btn.setBounds (5, 125, 85, 18);
            add (btn);

            btn = new Button ("help");
            //btn.setToolTipText ("spins the paper around!");
            btn.addActionListener (actions);
            btn.setBounds (5, 145, 85, 18);
            add (btn);

            if (cutfold.debug) {
                btn = new Button ("step");
                btn.addActionListener (actions);
                btn.setBounds (5, 165, 85, 18);
                add (btn);

                btn = new Button ("exit");
                btn.addActionListener (actions);
                btn.setBounds (5, 185, 85, 18);
                add (btn);
            } else {
                btn = new Button ("save");
                // btn.setToolTipText ("save to the gallery with printable version and caption");
                btn.setBounds (5, 165, 85, 18);
                btn.addActionListener (actions);
                add (btn);

                add (caption = new TextField("", 20));
                caption.setBounds (15, 185, 125, 18);
                // caption.setOpaque (true);
            }

            mt = new MouseTrap (cutfold);
            addMouseListener (mt);
            addMouseMotionListener (mt);
        }
        // for swing:
        // setBorder(BorderFactory.createLineBorder(Color.blue));
        // setOpaque (true);
        // We handle our own double buffering so we can present the same behavior as in AWT
        // setDoubleBuffered (false);
    }

    public void update(Graphics g) {
        paint(g);
    }

    public void paint (Graphics g) {
        // super.paint (g);
        paintComponent (g);
    }

    public void paintComponent (Graphics g) {
        // Paint is the main entry point of the program

        Rectangle extent = getBounds();
        Graphics og = getOSGraphics(extent);

        og.setColor (new Color(0xffffd7));
        og.fillRect (0, 0, extent.width, extent.height);
        drawGrid (og, extent.width, extent.height);
        if (cutfold.scale_timer > 0) {
            cutfold.tweenModel (og);
        } else {
            cutfold.drawModel (og);
        }
        drawGuidelines (og, extent.width, extent.height);
        
        og.drawString (mode, 10, extent.height - 15);

        if (help_text != null)
            og.drawString (help_text, 80, extent.height - 15);

        // draw any selections directly on screen
        if (mt != null) mt.draw (og);

        og.dispose();

        g.drawImage(offscreen, 0, 0, null);

        // check the consistency of the model data structure and possibly draw
        // some diagnostic information
        if (cutfold.polys != null && 
            cutfold.scale_timer == 0 && cutfold.tracing) 
            cutfold.checkModel (cutfold.polys);
    }

    Graphics getOSGraphics (Rectangle extent) {
        if (offscreen_width != extent.width || offscreen_height != extent.height) {
            offscreen = null;
        }
     	if(offscreen == null) {
      	   offscreen = createImage(extent.width, extent.height);
           offscreen_width = extent.width;
           offscreen_height = extent.height;
      	}
      	Graphics og = offscreen.getGraphics();
        og.setColor (new Color(0xffffd7));
        og.fillRect (0, 0, extent.width, extent.height);
        return og;
    }

    void drawGrid (Graphics g, int w, int h) {
        Color ltblue = new Color (0xe7edfb);
        Color blue = new Color (0xc5d5f5);
        int off = (w/2) % 20;
        for (int i=off; i<w; i += 20) {
            g.setColor (((i-w/2) % 100 == 0) ? blue : ltblue);
            g.drawLine (i, 0, i, h);
        }
        off = (h/2) % 20;
        for (int i=off; i<h; i += 20) {
            g.setColor (((i-h/2) % 100 == 0) ? blue : ltblue);
            g.drawLine (0, i, w, i);
        }
    }

    void drawGuidelines (Graphics g, int w, int h) {
        if (guidelines != null && cutfold.fold_index == cutfold.fold_level) 
            // if fold_index == fold_level the user has not yet unfolded
            // and refolded
        {
            int fold_level = cutfold.fold_level;
            if (2 * fold_level < guidelines.size()) {
                Guideline gl;
                if (mode == "fold" || mode == "folding") {
                    gl = ((Guideline) (guidelines.elementAt (2 * fold_level)));
                } else {
                    gl = ((Guideline) (guidelines.elementAt (2 * fold_level + 1)));
                }
                gl.draw (g, w, h, cutfold.xoff, cutfold.yoff, cutfold.scale);
            }
        }
    }

    public void enable_undo (boolean toggle) {
        if (undo_btn != null)
            undo_btn.setEnabled (toggle);
    }

    public String getCaptionText () {
        return caption.getText ();
    }

    public String getMode () {
        return mode;
    }

    public void setMode (String new_mode) {
        mode = new_mode;
        help_text = null;
        if (mode == "discard") {
            setCursor (new Cursor (Cursor.CROSSHAIR_CURSOR));
        } else if (mode == "confirm fold") {
            setCursor (new Cursor (Cursor.S_RESIZE_CURSOR));
        } else if (mode == "cut") {
            setCursor (new Cursor (Cursor.HAND_CURSOR));
        } else {
            setCursor (new Cursor (Cursor.DEFAULT_CURSOR));
        }
        show_help ();
        // update since text may have changed
        repaint ();
    }

    public void setHelpText (String ht) {
        help_text = ht;
        //repaint ();
    }

    public void show_help () {
        if (mode.equals( "" )) {
            setHelpText ("Select an action to perform, one of: cut, fold, unfold, discard, undo, spin or save.");
        }
        else if (mode.equals( "fold" ) || mode.equals ("folding")) {
            setHelpText ("Click, hold and drag to draw a crease.");
        }
        else if (mode.equals( "cut" ) || mode.equals( "cutting" )) {
            setHelpText ("Click, release and move.  Repeat at will.  Double-click (or make a closed shape) to finish.");
        }
        else if (mode.equals( "confirm fold" )) {
            setHelpText ("Click on one side of the new crease to fold that side down.");
        }
        else if (mode.equals( "discard" )) {
            setHelpText ("Click on a piece of paper to discard it.");
        }
    }
}

