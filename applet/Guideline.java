import java.awt.*;
import java.util.*;

public class Guideline {

    String text;
    int x1, y1, x2, y2;
    String action;
    static Polygon triangle;
    static Color dkgreen;
    
    Guideline (String text, int x1, int y1, int x2, int y2, String action) {
        this.text = new String(text);
        this.action = new String(action);
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        if (dkgreen == null) {
            dkgreen = new Color (0x116611);
        }
        if (triangle == null) {
            triangle = new Polygon ();
            triangle.fgcolor = dkgreen;
            Vertex last = new Vertex(-1, 0, null);
            Vertex v = new Vertex(1, 0, last);
            v = new Vertex(0, (double) -Math.sqrt(3.0), v);
            last.next = v;
            triangle.points = v;
        }
    }

    void draw (Graphics g, int w, int h, int xoff, int yoff, double scale) {
        g.setColor (dkgreen);
        g.drawString (text, 10, h - 30); 

        if (action.equals ("crease")) {
            float dx = x2 - x1, dy = y2 - y1;
            for (int i=0; i<50; i++) {
                g.drawLine ((int) (Math.round((x1 + dx * i / 50) * scale) + xoff), 
                            (int) (Math.round((y1 + dy * i / 50) * scale) + yoff), 
                            (int) (Math.round((x1 + dx * (i+0.5) / 50) * scale) + xoff), 
                            (int) (Math.round((y1 + dy * (i+0.5) / 50) * scale) + yoff));
            }
        } else if (action.equals ("fold")) {
            int xx1, yy1;
            xx1 = (int) (Math.round(x1 * scale) + xoff);
            yy1 = (int) (Math.round(y1 * scale) + yoff);
            triangle.draw (g, xx1, yy1, scale, false);
        }
    }

    static Vector snowflakeGuidelines () {
        Vector sg = new Vector ();
        sg.addElement (new Guideline ("Make a crease by clicking and dragging along the dashed line.",
                                      -75, 0, 75, 0, "crease"));
        sg.addElement (new Guideline ("Fold down by clicking near the green triangle.",
                                      0, -25, 0, 0, "fold"));
        sg.addElement (new Guideline ("Make a crease by clicking and dragging along the dashed line.",
                                      4, -5, -44, 55, "crease"));
        sg.addElement (new Guideline ("Fold down by clicking near the green triangle.",
                                      -40, 25, 0, 0, "fold"));
        sg.addElement (new Guideline ("Make a crease by clicking and dragging along the dashed line.",
                                      -4, -5, 44, 55, "crease"));
        sg.addElement (new Guideline ("Fold down by clicking near the green triangle.",
                                      40, 25, 0, 0, "fold"));
        sg.addElement (new Guideline ("Make a crease by clicking and dragging along the dashed line.",
                                      0, -5, 0, 60, "crease"));
        sg.addElement (new Guideline ("Fold down by clicking near the green triangle.",
                                      10, 25, 0, 0, "fold"));
        sg.addElement (new Guideline ("Now press the cut button and then click-drag the mouse to start cutting.  Best to start outside the paper, enter and exit, then click on the scraps to discard.",
                                      0, 0, 0, 0, "cut"));
        sg.addElement (new Guideline ("", 0, 0, 0, 0, "cut"));
        return sg;
    }
}
