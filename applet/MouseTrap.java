import java.awt.*;
import java.awt.event.*;

class MouseTrap extends MouseAdapter implements MouseMotionListener {

    Cutfold app;
    int press_x, press_y, move_x, move_y, release_x, release_y;

    public  MouseTrap (Cutfold app) {
        this.app = app;
    }

    public void handleMousePress (int x, int y, int nclicks) {

        // Cutfold.trace  ("mouse down (" + x + "," + y + ")");
        CFPanel pane = app.pane;
        String mode = pane.getMode ();
        if (mode == "cut") 
        {
            Vertex v = new Vertex(x, y);
            if (app.initCut (v)) {
                pane.setMode("cutting");
                x = (int) Math.round (v.x);
                y = (int) Math.round (v.y);
            }
        }
        else if (mode == "fold") 
        {
            pane.setMode("folding");
        }
        else if (mode == "cutting") 
        {
            Vertex v = new Vertex(x, y);
            app.globalToLocal (v);
            // On a double click, we get called for the first click
            // and then again for the second click
            if (app.cutSelect (v, nclicks > 1)) {
                if (app.cutModel ()) {
                    pane.setMode ("discard");
                }
            } else {
                // We might have snapped the cursor to a nearby point
                app.localToGlobal (v);
                x = (int) Math.round (v.x);
                y = (int) Math.round (v.y);
                drawSegment (x, y);
            }
        } else if (mode == "discard") {
            if (!app.discardPolygon (x, y)) 
            {
                // leave discard mode when you click in the bg
                pane.setMode ( "" );
            }
        }
        else if (mode == "confirm fold") {

            // clear the fold "cursor"
            Graphics g = pane.getGraphics ();
            g.setXORMode (Color.white);
            g.drawLine (press_x, press_y, move_x, move_y);

            // clear ();
            // check which side of press_x, press_y, release_x, release_y that _xmouse, _ymouse is on...
            if (app.rhsTest (press_x, press_y, release_x, release_y, x, y)) {
                app.foldModel (release_x, release_y, press_x, press_y);
            } else {
                app.foldModel (press_x, press_y, release_x, release_y);
            }
            pane.setMode ("fold");
        }
        move_x = press_x = x;
        move_y = press_y = y;
    }

    public void mousePressed (MouseEvent evt) {

        if (app.script != null) {
            app.script.captureMousePress (evt); // for debugging
        }

        handleMousePress (evt.getX(), evt.getY(), evt.getClickCount());
    }

    public void handleMouseRelease (int x, int y) {
        if (app.pane.getMode() == "folding")
        {
            release_x = x; 
            release_y = y;

            // extend selection to +/- infinity
            double dx = release_x - press_x, dy = release_y - press_y;
            double scale = Math.abs(dx) > Math.abs(dy) ? 
                Math.abs(dx) : Math.abs(dy);
            if (scale < 1) {
                scale = 1;
            } else {
                scale = 500 / scale;
            }
            press_x -= scale * dx;
            press_y -= scale * dy;
            release_x += scale * dx;
            release_y += scale * dy;
            move_x = release_x; 
            move_y = release_y;
            app.pane.repaint ();     // draw new instructions
            app.pane.setMode("confirm fold");
        }
    }

    public void mouseReleased (MouseEvent evt) {
        if (app.script != null) {
            app.script.captureMouseRelease (evt); // for debugging
        }
        handleMouseRelease (evt.getX(), evt.getY());
    }

    public void mouseDragged (MouseEvent evt) {
        if (app.pane.getMode() == "folding") {
            drawSegment (evt.getX(), evt.getY());
        }
    }

    public void mouseMoved (MouseEvent evt) {
        if (app.pane.getMode() == "cutting") {
            drawSegment (evt.getX(), evt.getY());
        }
    }

    public void draw (Graphics g) {
        // draw the current cursor state
        if (app.pane.getMode() == "confirm fold") {
            g.setXORMode (Color.white);
            g.drawLine (press_x, press_y, move_x, move_y);
        }
    }

    private void drawSegment (int x, int y) {
        Graphics g = app.pane.getGraphics ();
        g.setXORMode (Color.white);
        g.drawLine (press_x, press_y, move_x, move_y);
        move_x = x;
        move_y = y;
        g.drawLine (press_x, press_y, move_x, move_y);
    }
}
