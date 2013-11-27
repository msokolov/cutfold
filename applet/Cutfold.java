/*
 * Cutfold.java
 *
 * Version 1.0 December 2002 - April, 2003
 * Version 1.1 July 2003 - 
 *  Mike Sokolov (sokolov@ifactory.com)
 */

/**
 *
 * @author  sokolov
 * @version 1.1
 */
import java.lang.*;
import java.util.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.image.*;
import java.applet.*;
import java.text.*;
import java.net.*;
import java.io.*;

public class Cutfold extends Applet implements ComponentListener {

    Vector polys, polys_undo_copy, polys_tween_copy;

    CFPanel pane;

    // limits us to no more than 512 polygons
    private static int[] tween_map = new int[512];
    private boolean tween_map_has_dest;

    // setting debug true writes out all commands so they can be replayed
    boolean debug = false;
    String [] args;

    Affine tween_axis;
    int rotation_style;         // 0 - none, 1 - rotate behind, 2- rotate left to right

    // bounding box
    double left, right, top, bottom;

    // scaling transform
    int xoff, yoff, xoff_target, yoff_target, xoff_start, yoff_start;
    long scale_timer;
    int scale_time;
    double scale, scale_target, scale_start;

    int zlevels, zlevels_copy;
    int fold_level, fold_level_copy;
    int fold_index, fold_index_copy;

    Polygon pcut;
    String mode;

    Button undo_btn, fold_btn, cut_btn;
    TextField caption;

    static boolean tracing = false;

    Script script;

    public String getParameter (String key) {
        if (args != null) {
            for (int i = 0; i < args.length; i++) {
                if (args[i].equals(key)) {
                    return args[i+1];
                }
            }
            return null;
        } else {
            return super.getParameter (key);
        }
    }

    public static void main(String args[]) {
        Frame frame = new Frame ("cutfold");
        frame.setSize (640, 480);
        frame.addWindowListener (new CutfoldWindowListener(frame));
        Cutfold applet = new Cutfold();
        applet.setSize (640, 480);
        applet.args = args;
        frame.add (applet);
        applet.init();
        applet.start();
        frame.setVisible(true);
        // applet.stop();
    }

    public void init() {

        Polygon.initColors();

        String param = getParameter ("showGuidelines");
        boolean showguides = (param != null && param.compareTo ("1") == 0);
        param = getParameter ("readonly");
        boolean readonly = (param != null && param.compareTo ("1") == 0);
        param = getParameter ("debug");
        debug = (param != null && param.compareTo ("1") == 0);
        param = getParameter ("trace");
        tracing = (param != null && param.compareTo ("1") == 0);

        pane = new CFPanel (this, showguides, readonly);
        setContentPane (pane);

        reset();                // initialize polygon data structure
    }

    void setContentPane (Panel pane) {
        addComponentListener (this);
        handle_resize();
        this.add (pane);
    }

    public void componentResized (ComponentEvent e) {
        handle_resize ();
    }
    public void componentMoved (ComponentEvent e) {
    }
    public void componentHidden (ComponentEvent e) {
    }
    public void componentShown (ComponentEvent e) {
    }

    void handle_resize () {
        pane.setLocation (0, 0);
        Rectangle extent = getBounds();
        pane.setSize (extent.width, extent.height);
        rescale_canvas (0, false);
    }

    void reset () {

        polys = new Vector (32);
        polys_undo_copy = null;
        polys_tween_copy = null;
        tween_axis = null;
        rotation_style = 0;

        xoff = yoff = 0;
        scale = (double) 1.0;
        scale_timer = 0;

        zlevels = 1;
        zlevels_copy = 1;
        fold_level = 0;
        fold_level_copy = 0;
        fold_index = 0;
        fold_index_copy = 0;

        if (debug) {
            String script_path = getParameter ("script");
            System.out.println ("script=" + script_path);
            if (script_path != null) {
                script = new Script (script_path);
            }
        }
        String model_path = getParameter ("model");
        System.out.println ("model=" + model_path);
        if (model_path != null) {
            load_model (model_path);
        } else {
            default_model ();
        }

        pane.enable_undo (false);
        pane.setMode ("fold");

        refresh (null);
    }

    // recalculate some cached data structures when the geometry or topology changes
    // also forces a repaint.
    void refresh (Affine axis) {
        getModelBounds (true);
        // sort in descending z order so that polys will be drawn bottom up
        Polygon.sort (polys, false);
        if (axis != null) {
            make_tween_map (polys, true);
            compute_axis_distances (axis);
            tween_axis = axis;
            rotation_style = 1;
            rescale_canvas (2000, true);
        } else {
            rescale_canvas (100, true);
        }
        pane.repaint ();
    }

    // disable default Component behavior - don't clear background before painting
    /*
    public void update(Graphics g) {
        paint(g);
    }

    public void paint(Graphics g) {
        pane.paintComponent(g);
    }
    */
    void rescale_canvas (int delay, boolean repaint) {

        // center and scale to just fit in 400 x 400
        Rectangle extent = getBounds();
        double cx = (left + right) / (double) 2.0;
        double cy = (bottom + top) / (double) 2.0;

        scale_target = ((right - left) > (bottom - top) ? 
                        (400 / (double) (right - left)) : 
                        (400 / (double) (bottom - top)));
        xoff_target = (int) ((extent.width/2) - Math.round(cx * scale_target));
        yoff_target = (int) ((extent.height/2) - Math.round(cy * scale_target));
        scale_start = scale;
        xoff_start = xoff;
        yoff_start = yoff;
        // when drawing, transform points from model space to screen
        // space by (x,y)*scale + (xpos, ypos)
        scale_timer = (new Date()).getTime();
        scale_time = delay;
        //System.out.println ("xoff="+xoff+", yoff="+yoff+" scale="+scale);
        //System.out.println ("target xoff="+xoff_target+", yoff="+yoff_target+" scale="+scale_target);
        if (repaint) { pane.repaint (); }
    }

/*
 * rhsTest
 *  checks which side of (x1,y1)->(x2, y2) (x,y) is on; returns 
 *  a boolean indicating whether it's on the rhs (or on the line itself).
 */
    boolean rhsTest (int x1, int y1, int x2, int y2, int x, int y) {
        int px = x - x1;
        int py = y - y1;
        int rx = x2 - x1;
        int ry = y2 - y1;
        return (px*ry - py*rx) <= 0;
    }

    void globalToLocal (Vertex v) {
        // convert screen coordinates to paper coordinates
        v.x = (v.x - xoff) / scale;// used to round???
        v.y = (v.y - yoff) / scale;
    }

    void localToGlobal (Vertex v) {
        // convert paper coordinates to screen coordinates
        v.x = (v.x * scale) + xoff;
        v.y = (v.y * scale) + yoff;
    }

    void undo () {
        if (polys_undo_copy != null) {
            // restore previous data structures:
            zlevels = zlevels_copy;
            fold_level = fold_level_copy;
            fold_index = fold_index_copy;
            polys = polys_undo_copy;

            pane.enable_undo (false); // only one level of undo
            polys_undo_copy = null;
            refresh (null);
        }
    }

/*
    void print ()  {
        PrinterJob pj = PrinterJob.getPrinterJob ();
        pj.setPrintable (this);
        if (pj.printDialog()) {
            try {
                pj.print ();
            } catch (PrinterException pe) {
                System.out.println ("PrinterException " + pe);
            }
        }
    }

    int print (Graphics g, PageFormat pf, int page) {
        if (page != 1) {
            return NO_SUCH_PAGE;
        }
        drawModel (g);
        return PAGE_EXISTS;
    }
*/

/* foldModel (x1, y1, x2, y2)
 *
 * folds (reflects, flips and raises/lowers in stacking order) a set
 * of polygons intersected by a line segment.  Note: there is a problem
 * with this in that it allows polygons to be folded "through" each other.
 * This can be prevented by requiring the line segment to begin and end
 * outside the polygons (I think).  Or it might be possible to detect the
 * obstruction of a folding poly by another poly above or below it that is
 * not being folded.  In this case we could either prevent the fold or
 * possibly "tuck" the fold in an interior layer.  In any case all that
 * stuff would require a bunch of expensive geometry. 
 *
 *   Each of the polygons in the model is tested for intersection with the line segment,
 *   and possibly split.
 *   foldPoly will fold polygons using a right-hand rule.
 *   After being split, the halves to the right of the fold line are folded
 *   underneath (they are reflected about the fold line and have their z-value reflected
 *   around the (new) central z value.
 */


    void foldModel (int x1, int y1, int x2, int y2) {
        Vertex v1 = new Vertex (x1, y1);
        Vertex v2 = new Vertex (x2, y2);
        globalToLocal (v1);
        globalToLocal (v2);
        v1.next = v2;

        Vector pcopy = copyModel ();
        Vector new_polys = new Vector ();
        int i, npolys = polys.size();
        

        for (i = 0; i < npolys; i++) {
            getPoly(i).fold (v1, new_polys, fold_level + 1, fold_index + 1);
        }
        if (new_polys.size() <= 0)
            return;
        polys_undo_copy = pcopy;     // save copy for undo
        pane.enable_undo (true);

        // only in Java 2.0:
        // polys.addAll (new_polys);
        for (i=0; i<new_polys.size(); i++) {
            polys.addElement (new_polys.elementAt(i));
        }

        // save a copy before reflecting for use in animating the fold
        polys_tween_copy = copyModel ();
        Polygon.sort (polys_tween_copy, false);

        // traverse the polygon graph, propagating the flipme flag to 
        // mark the dependent polygons to be folded.
        Polygon p = (Polygon) new_polys.elementAt(0);
        p.markPolyGraph (p.flipme, null, fold_index + 1);
        zlevels *= 2;
        reflectMarkedPolys (polys, v1, v2, zlevels);
        clearPolyFlags (polys);
        fold_level ++;
        fold_index ++;

        // print ();
        refresh (new Affine (v1, v2));
    }

/* unfold_once
 * unfolds (reflects, flips and raises/lowers in stacking order) a
 * bottommost polygon.  This function assumes the canvas.polys are
 * sorted in inverse stacking order, which happens when they're drawn.  Not
 * all folds can be unfolded without unfolding others first: However, some
 * folds are "exterior" and always unfoldable regardless of the geometry.
 * We first tried to choose one by finding the fold on the bottommost
 * polygon that adjoins the highest neighbor.  Q: is this always
 * unfoldable? Nope.  It seems that because we don't remove folds after
 * they're unfolded (they remain, albeit flattened out, as creases), the
 * bottom-most poly we happen to choose may not actually lie on a fold
 * (just a crease).  So try them all until we find one... 
 */
 
    void unfold_once () {
        trace ("unfold,level=" + fold_level);
        if (fold_level <= 0) 
            return;

        polys_tween_copy = polys_undo_copy = copyModel (); // save for undo and tweening
        // trace ("copied polys");
        pane.enable_undo (true);

        // this depends on operating in stacking order because of the way we
        // modify the structure as we go.  The "flipped" polygons will always
        // show up first (because we always fold down and unfold up).

        int j;
        int zmid = (1 << fold_level) / 2;
        for (j=0; j<polys.size(); j++)
        {
            if (getPoly(j).z < zmid)
                break;
        }
        //System.out.println ("zmid=" + zmid + ",  j=" + j);
        Vertex creases [] = new Vertex [j];
        Affine axis = null;
        // print ();
        // flip all polys w/z >= (2 ^ fold_level) / 2
        for (int i=0; i<j; i++) 
        {
            Polygon p = getPoly(i);
            Vertex v = p.points;
            Vertex pv = v.findPrev ();
            int max_fold_level = -1;
            Vertex innermost = null;
            do {
                if (v.fold != null && v.fold.level == fold_level) {
                    // reflect the adjacent poly and any "descendants" on the same
                    // side of the edge v.
                    if (!p.flipped) {
                        Polygon p1 = v.fold.twin.v.poly;
                        p.is_anchor = true;
                        p1.is_anchor = true;
                        p1.flipme = false;
                        p.markFoldedPolys (v.fold.index, null);
                        reflectMarkedPolys (polys, v, v.next, zlevels);
                        if (axis == null) {
                            axis = new Affine (v, v.next);
                        }
                    }
                    if (max_fold_level < 0) {
                        innermost = v;
                        max_fold_level = 0;
                    }
                    if (v.next.fold != null && v.next.fold.level > max_fold_level) {
                        max_fold_level = v.next.fold.level;
                        innermost = v;
                    }
                    if (pv.fold != null && pv.fold.level > max_fold_level) {
                        max_fold_level = pv.fold.level;
                        innermost = v;
                    }
                }
                pv = v;
                v = v.next;
            } while (v != p.points);

            // remember innermost creases so we can flatten them later.
            // We do this in a separate pass so that the original topology is preserved
            // for tweening against the non-unfolded copy
            creases[i] = innermost;
        }
        /*
          for (int i=0; i<j; i++) {
            if (creases[i] != null) {
                // merge two polygons together.  There will be one or several
                // edges shared.  One pair of them will be merged together; the others will
                // remain as creases.  The one to remove must connect to the highest
                // numbered fold.  This ensures that creases ultimately connect to the exterior
                // and ensures that adjoining polygons will have congruent crease structures
                // trace ("unfolding " + p.id);
                creases[i].fold.unfold ();
            }
        }
        */
        for (int i=0; i<j; i++) {
            // instead of erasing creases, just mark them so they can be displayed 
            // differently
            if (creases[i] != null) {
                creases[i].fold.mark_creases ();
                creases[i].fold.twin.mark_creases ();
            }
        }
        cullEmptyPolys (polys);
        clearPolyFlags (polys);
        -- fold_level;
        zlevels /= 2;
        refresh (axis);
    }

    void cullEmptyPolys (Vector polys) {
        for (int i = 0; i < polys.size(); i++) {
            if (getPoly(i).points == null) {
                polys.removeElementAt (i); /* remove the poly */
                --i;
            }
        }
    }

    boolean initCut (Vertex v) {
        double min_dist = 5;
        globalToLocal (v);
        // TBD figure out if what it says just below is really true and 
        // maybe remove the following test:
/*
        for (int i=0; i<polys.size(); i++) {
            // only allow cuts to start outside the paper.  This avoids
            // a buggy situation I think.  If you start and end inside the
            // poly and the edge connecting your first and last points 
            // leaves (and re-enters) the polygon then cutModel is broken
            if (getPoly (i).encloses (v)) {
                return false;
            }
        }
*/
        pcut = new Polygon();
        Vertex u = v.copy();
        pcut.points = u;
        localToGlobal (v);
        Graphics g = getGraphics();
        g.drawRect ((int) Math.round(v.x) - 2,
                    (int) Math.round(v.y) - 2,
                    5, 5);
        return true;
    }

    boolean cutSelect (Vertex v, boolean close_pcut) { 

        double min_dist = 5;
        // check for intersections w/pcut, and if there is one then form
        // a polygon and cut.
        // this prevents people from making self-intersecting polygons
        Vertex u, ux = null, ex = null, start;
        u = pcut.points;
        while (u.next != null) {
            // advance u to the end of the linked list - 
            // this will be the first point selected
            u = u.next;
            if (u == pcut.points) {
                // don't go infinite looping
                break;
            }
        } 

        if (!close_pcut) 
            {
                // end this cut if we are outside all polygons and we started
                // cutting outside all polygons
                //trace ("findPolygon (pcut.points)=" + findPolygon (pcut.points));
                //trace ("findPolygon (v)=" + findPolygon (v));
                if (findPolygon (u) == null && findPolygon (v) == null) {
                    close_pcut = true;
                    v.next = pcut.points;
                    pcut.points = v;
                    return true;
                }
            }
        if (close_pcut) {
            // the user double-clicked, so pretend they clicked on exactly
            // the first point again and check for self-intersections

            // NB - in this case we may already have come through here once
            // before with the same v and close_pcut=false (for the first
            // click of the double click).

            if (u == pcut.points.next) {
                // don't allow cutting with a single line segment if either
                // endpoint lies inside any polygon:
                // it introduces degenerate cases I don't want to deal with
                if (findPolygon(u) != null || 
                    findPolygon (pcut.points) != null) 
                    return false;
            }
            // TBD - we should try cutting withour closing pcut if possible
            //  - change this so only we test only for 
            // explicit self - intersections; don't create this link; leave
            // pcut open.
            /*
            if (u.next == null) {
                v = u;
            }
            */
            trace ("cutSelect return true");
            return true;
        }
        else {
            double tmax = 0, treturn[] = new double[1];
            // makes an inf. loop if ! close_pcut
            v.next = pcut.points;
            for (u = pcut.points.next;
                 u != null && u.next != null && u != pcut.points;
                 u = u.next) {
                Vertex uxx = v.intersectEdges (u, treturn);
                if (uxx != null && treturn[0] > tmax
                    && treturn[0] < 0.9999
                    // ignore intersections with the previous segment
                    ) {
                    tmax = treturn[0];
                    ux = uxx;
                    ex = u;
                }
            } 
            if (ux != null) {
                // just use the closed part of the polygon for cutting?
                // lops off the tails
                ex.next = ux;
                u = ux;
            } else {
                // Don't link v into pcut since our caller references values in it
                u = v.copy ();
            }
            u.next = pcut.points;
            pcut.points = u;

            if (ux != null)
                return true;        // go ahead and cut
        }
        Graphics g = getGraphics();
        g.drawRect ((int) Math.round(v.x - 2), (int) Math.round(v.y - 2), 
                    5, 5);
        trace ("cutSelect return false");
        return false;           // continue selecting
    } 

    boolean cutModel () {
        Vector new_polys = new Vector();
        Vector new_new_polys = new Vector();
        Vector cut_folds = new Vector();
        int i;

        polys_undo_copy = copyModel (); // save for undo
        pane.enable_undo (true);

        trace ("cutModel");
        
        int npolys = polys.size();
        pcut.computeBoundingBox ();
        for (i = 0; i < npolys; i++) {
            Polygon p = getPoly(i);
            if (! pcut.overlaps (p)) {
                // perform simple bounding box test to exclude some
                // polygons from the more expensive computations
                trace ("pcut does not overlap poly " + p.id);
                continue;
            }
            trace ("cutting poly " + p.id);
            try {
                p.cut (pcut, new_new_polys, cut_folds);
            } catch (NullPointerException e) {
                // we have a bug - try to recover gracefully until we can 
                // figure out what it is and fix it!
                if (debug) {
                    throw (e);
                } else {
                    undo();
                    return false;
                }
            }
            p.computeBoundingBox ();
            // don't try to cut the new_polys

            // Java 2.0 only:
            // new_polys.addAll (new_new_polys);
            for (int j=0; j<new_new_polys.size(); j++) {
                new_polys.addElement (new_new_polys.elementAt(j));
            }
            new_new_polys.removeAllElements();
        }
        while (new_polys.size() > 0) {
            Polygon p = (Polygon) new_polys.elementAt(0);
            new_polys.removeElementAt(0);
            p.computeBoundingBox ();
            polys.addElement (p);
        }
        while (cut_folds.size() > 0) {
            Fold f = (Fold) cut_folds.elementAt (0);
            cut_folds.removeElementAt(0);
            f.patchCut ();
        }
        refresh (null);
        return true;
    }

    Vector copyModel () {
        Vector polys_copy = new Vector (polys.size());
        int polymap[] = new int[Polygon.next_id];
        for (int i =0; i < polys.size(); i++) {
            Polygon p = new Polygon (getPoly(i));
            polys_copy.addElement (p);
            polymap [p.id] = i;
        }
        // match up folds:
        for (int i = 0; i < polys.size(); i++) {
            Polygon p = (Polygon) polys_copy.elementAt (i);
            Polygon q = (Polygon) polys.elementAt (i);
            Vertex u = p.points, v = q.points;
            // System.out.println ("copying poly " + i);
            do {
                if (v.fold != null) {
                    if (u.fold == null) {
                        u.fold = new Fold (u, v.fold.level, v.fold.index);
                    }
                    int j = polymap[v.fold.twin.v.poly.id];
                    if (j < i) {
                        // u.fold's twin has already been created; find it
                        Polygon p1 = (Polygon) polys_copy.elementAt (j);
                        Polygon q1 = (Polygon) polys.elementAt (j);
                        Vertex u1 = p1.points, v1 = q1.points;
                        do {
                            v1 = v1.next;
                            u1 = u1.next;
                        } while (v1 != v.fold.twin.v && v1 != q1.points);
                        // and link to it
                        if (v1 != v.fold.twin.v) {
                            trace ("copyModel couldn't link up fold?");
                        } else {
                            u1.fold.twin = u.fold;
                            u.fold.twin = u1.fold;
                        }
                    }
                }
                u = u.next;
                v = v.next;
            } while (u != p.points);
        }
        zlevels_copy = zlevels;
        fold_level_copy = fold_level;
        fold_index_copy = fold_index;
        return polys_copy;
    }

/*
 * polygon selection
 */

    Polygon findPolygon (int x, int y) {
        // x,y in screen coordinates
        Vertex v = new Vertex (x, y);
        globalToLocal (v);
        return findPolygon (v);
    }

    Polygon findPolygon (Vertex v) {
        // v in model coordinates
        for (int i = polys.size() - 1; i >= 0; i--)
        {
            Polygon p = getPoly(i);
            if (p.contains(v))
            {
                return p;
            }
        }
        return null;
    }

    boolean discardPolygon (int x, int y) {
        Polygon p;
        boolean found = false;

        Vector pcopy = copyModel (); // save for undo

        while ((p = findPolygon (x, y)) != null)
        {
            // System.out.println ("discard found poly " + p.id);
            p.markPolyGraph (true, null, -1); // set the flipme flag
            for (int i = 0; i < polys.size(); i++)
            {
                Polygon q = getPoly(i);
                if (q.flipme) {
                    // System.out.println ("discard removing poly " + q.id);
                    polys.removeElementAt (i);
                    --i;
                    found = true;
                }
            }
        }
        if (found) {
            polys_undo_copy = pcopy;
            pane.enable_undo (true);
        }
        refresh (null);
        return found;
    }

/************************************************************************
 * polygon manipulation: cutting and folding
 ************************************************************************/
 
    void reflectMarkedPolys (Vector polys, Vertex v1, Vertex v2, int zlevels) {
        int npolys = polys.size();
	
        // fold all the marked polygons now.  These will be the ones on the flipme 
        // side of the fold or connected via earlier folds to one on the flipme.
        for (int i = 0; i<npolys; i++) {
            Polygon p = getPoly(i);
            if (p.flipme && !p.flipped) {
                p.reflect (v1, v2, zlevels);
                p.flipped = true;
            }
        }
    }

    void clearPolyFlags (Vector polys) {
        for (int i = 0; i<polys.size(); i++) {
            Polygon p = getPoly(i);
            p.clearFlags ();
        }
    }

    public String getAppletInfo() {
        return "Title: Cutfold\ncopyright &copy; 2003 Mike Sokolov.";
    }
  
    public String[][] getParameterInfo() {
        String[][] info = {
            { "model", "url", "snowflake XML file to load" },
            { "readonly", "0/1", "if 1, no editing controls shown" },
            { "showGuidelines", "0/1", "if 1, show folding guides" },
        };
        return info;
    }

    void make_tween_map (Vector tween_polys, boolean is_dest) {
        for (int i = 0; i < polys.size(); i++) {
            tween_map[((Polygon)tween_polys.elementAt(i)).id] = i;
        }
        tween_map_has_dest = is_dest;
    }

    void tweenModel (Graphics g) {
        long t = (new Date()).getTime();
        double ratio = 1.0;
        if (t < scale_timer + scale_time) {
            ratio = (t - scale_timer) / (double) scale_time;
            double r2 = Math.sqrt (ratio);
            xoff = (int) Math.round (xoff_start + (xoff_target - xoff_start) * r2);
            yoff = (int) Math.round (yoff_start + (yoff_target - yoff_start) * r2);
            scale = (double) (scale_start + (scale_target - scale_start) * r2);
        } else {
            xoff = xoff_target;
            yoff = yoff_target;
            scale = scale_target;
            scale_timer = 0;
            polys_tween_copy = null;
            tween_axis = null;
            rotation_style = 0;
        }

        if (polys_tween_copy != null) {
            // In the first half of the tween, use the "before" stacking order 
            // (tween_map is used to map to the "destination" polys)
            // and in the second half, update the tween_map so we can use the
            // "destination" stacking order
            if (tween_map_has_dest && ratio > 0.5) {
                make_tween_map (polys_tween_copy, false);
            }
            tweenModelPair (g, polys_tween_copy, polys, ratio);
        } else {
            drawModel (g);
        }

        // call this function again in a little while:
        if (scale_timer > 0) {
            pane.repaint();
        }
    }

    void tweenModelPair (Graphics g, Vector from_polys, Vector to_polys, double t) {
        for (int i = 0; i<from_polys.size(); i++) {
            Polygon pfrom, pto;
            if (t < 0.5) {
                pfrom = (Polygon) from_polys.elementAt(i);
                pto = (Polygon) to_polys.elementAt(tween_map[pfrom.id]);
            } else {
                pto = (Polygon) to_polys.elementAt(i);
                pfrom = (Polygon) from_polys.elementAt(tween_map[pto.id]);
            }
            /*
            if (pto.id != pfrom.id) {
                System.out.println ("tweenModelPair: Polygon mismatch");
            }
            */
            pfrom.tween(pto, g, xoff, yoff, scale, t, rotation_style);
        }
    }

    void spin () {
        polys_tween_copy = copyModel ();
        Vertex v = new Vertex ((left+right)/2, top);
        Vertex v1 = new Vertex ((left+right)/2, bottom);
        for (int i = 0; i<polys.size(); i++) {
            getPoly(i).reflect (v, v1, zlevels);
        }
        refresh (new Affine (v, v1));
        rotation_style = 2;
    }

    void compute_axis_distances (Affine axis) {
        for (int i = 0; i<polys.size(); i++) {
            getPoly(i).compute_axis_distances(axis);
        }
    }

    void drawModel (Graphics g) {
        g.setColor (Color.blue);

        for (int i = 0; i<polys.size(); i++) {
            getPoly(i).draw(g, xoff, yoff, scale, tracing);
        }
    }

    void getModelBounds (boolean descend) {
        left  = 1000;
        right =-1000;
        top   = 1000;
        bottom=-1000;
        for (int i =0; i<polys.size(); i++) {
            Polygon p = getPoly(i);
            if (descend)
                p.computeBoundingBox ();
            if (p.left < left) left = p.left;
            if (p.right > right) right = p.right;
            if (p.top < top) top = p.top;
            if (p.bottom > bottom) bottom = p.bottom;
        }
    }

    void print () {
        for (int i =0; i<polys.size(); i++) {
            System.out.println (getPoly(i).xml());
        }
    }


    void postURL ()  {
        String caption = pane.getCaptionText();
        if (caption.equals( "" )) {
            pane.setHelpText ("Please enter a title for your flake.");
            return;
        }
        try {
            /*
             * should work but doesn't...insists on using GET not POST
            URL url = new URL ("http://bangor.ifactory.com/test/test.pl");
            URLConnection connx = url.openConnection ();
            System.out.println ("Class of connection: " + connx.getClass());
            connx.setDoOutput (true);
            connx.setDoInput (true);
            connx.setRequestProperty ("Content-Type", "application/xml");
            OutputStream os = connx.getOutputStream ();
            */
            String xml = "";
            for (int i =0; i<polys.size(); i++) {
                xml += getPoly(i).xml() + "\n";
            }
            // TBD - should HTML encode the caption...
            xml += "<caption>" + pane.getCaptionText() + "</caption>\n";
            URL myurl = getCodeBase ();
            int port = myurl.getPort();
            if (port < 0) port = 80;
            String path = myurl.getFile();
            path = path.substring (0, path.lastIndexOf('/')+1);
            Socket s = new Socket (myurl.getHost(), port);
            OutputStream out = s.getOutputStream();
            String header = "POST " + path + "save.cgi HTTP/1.0\n"
                + "Content-type: application/xml\n"
                + "Content-length: " + xml.length()
                + "\n\n";            
            out.write (header.getBytes());
            out.write (xml.getBytes());
            out.flush();

            InputStream in = new DataInputStream(new 
                BufferedInputStream(s.getInputStream()));
            int b;
            while ((b = in.read()) != -1) {
                System.out.write ((byte) b);
            }
            getAppletContext ().showDocument (new URL(getCodeBase(), "gallery/"));
        } catch (Exception e) {
            System.out.println ("Caught exception " + e);
            e.printStackTrace ();
        }
    }

    void checkModel(Vector polys) 
    {
        // trace ("ENTER checkModel");
        for (int i = 0; i<polys.size(); i++) {
            int pcount = 0;
            Polygon p = getPoly(i);
            Vertex u = p.points;
            do {
                if (u.fold != null) {
                    if (u.fold.v != u) {
                        trace ("u.fold.v1 != u");
                    }
                    if (u.fold.twin.twin != u.fold) {
                        trace ("u.fold.twin.twin != u.fold");
                    }
                    if (u.fold.twin.v.poly.points == null) {
                        trace ("u.fold.twin.v.poly.points (p.id=" + u.fold.twin.v.poly.id + ") is null");
                    }
                    if (! u.fold.twin.v.eq (u.next)) {
                        trace ("  ERROR fold.twin mismatch  ");
                        drawDiamond (u, Color.blue);
                        drawDiamond (u.next, Color.black);
                        drawDiamond (u.fold.twin.v, Color.red);
                        drawDiamond (u.fold.twin.v.next, Color.green);
                    }
                    if (u.fold.twin == u.fold ||u.fold.twin.v.poly == u.poly)
                        {
                            trace ("   ERROR fold is its own twin?");
                            //drawDiamond (u.fold.v1, cursor, 0x0000ff);
                            // drawDiamond (u.fold.v2, cursor, 0x0000ff);
                        }
                    Vertex v = u.fold.twin.v; // make sure v isn't orphaned
                    Vertex vv = v.poly.points;
                    int count = 0;
                    do {
                        vv = vv.next;
                        if (++count > 500) {
                            trace ("checkModel inner loop: WARNING: poly has > 100 points? possible inf. loop detected");
                            break;
                        }
                    }
                    while (vv != v && vv != p.points);
                    if (vv != v) {
                        trace ("  ERROR vertex has orphaned twin");
                        drawDiamond (u, Color.blue);
                        drawDiamond (u.fold.twin.v, Color.red);
                    }
                }
                if (u.poly.id != p.id) {
                    trace ("  ERROR point poly id mismatch");
                }
                u = u.next;
                if (++pcount > 500) {
                    trace ("checkModel inner loop: WARNING: poly has > 100 points? possible inf. loop detected");
                    break;
                }
            } while (u != p.points);
        }
        trace ("checkModel found " + polys.size() + " polygons");
    }

    void drawDiamond (Vertex v, Color c) 
    {
        Graphics g = getGraphics ();
        g.setColor (c);
        int x = (int) Math.round(v.x * scale) + xoff;
        int y = (int) Math.round(v.y * scale) + yoff;
        System.out.println ("diamond " + x + ", " + y);
        g.fillRect (x-2, y-2, 5, 5);
    }

    static void trace (String msg) {
        if (tracing) {
            System.out.println (msg);
        }
    }

    Polygon getPoly (int i) {
        return (Polygon) polys.elementAt (i);
    }
    
    void default_model () {
        // Initialize square pce of paper 
	Vertex last = new Vertex(-50, -50, null);
	Vertex v = new Vertex(50, -50, last);
	v = new Vertex(50, 50, v);
	v = new Vertex(-50, 50, v);
	Polygon square = new Polygon();
	square.points = v;
	last.next = v;
        square.setPointsPoly ();
	polys.addElement (square);
    }

    void load_model (String model_path) {
        try {
            URL docurl = getDocumentBase ();
            int port = docurl.getPort();
            if (port < 0) port = 80;
            String path = docurl.getFile();
            path = path.substring (0, path.lastIndexOf('/')+1);

            System.out.println ("host=" + docurl.getHost());
            InputStream is;
            Socket s;
            if (docurl.getHost() != null && docurl.getHost().length() > 0) {
                s = new Socket (docurl.getHost(), port);
                OutputStream out = s.getOutputStream();
                String header = "GET " + path + model_path + " HTTP/1.0\n\n";
                out.write (header.getBytes());
                out.flush();
                is = s.getInputStream();
            } else {
                is = new FileInputStream ( new File (path + model_path));
            }
            String xml = "";
            int ttype;
            Polygon p = null;
            Vertex v = null, w = null;
            int state = 0;
            /*
              parser states:
              0 - outer scope
              1 - in polygon attributes
              2 - in polygon body (expecting vertices or /polygon)
              3 - in vertex attributes
              4 - in vertex body
              5 - in caption attributes
            */
            XMLParse parser = new XMLParse (is);
            Hashtable vertex_map = new Hashtable();
            String tag;
            fold_level = 0;
            fold_index = 0;
            while ((tag = parser.nextTag ()) != null) {
                // System.out.println (tag);
                if (tag.compareTo ("polygon") == 0) {
                    if (p != null) trace ("ERROR: nested polygons ");
                    p = new Polygon ();
                    p.id = Integer.parseInt((String) parser.attrs.get("id"));
                    p.z = Integer.parseInt((String) parser.attrs.get("z"));
                    p.faceup = (((String) parser.attrs.get("faceup")).compareTo ("true") == 0);
                } else if (tag.compareTo ("/polygon") == 0) {
                    v = p.points;
                    while (v.next != null) 
                        v = v.next;
                    v.next = p.points;
                    polys.addElement (p);
                    p = null;
                    v = null;
                    w = null;
                } else if (tag.compareTo ("vertex") == 0) {
                    if (v != null) trace ("ERROR: nested vertices");
                    if (p == null) {
                        trace ("ERROR: vertex outside of polygon");
                        continue;
                    }
                    v = new Vertex (Double.valueOf((String) parser.attrs.get("x")).doubleValue(), 
                                    Double.valueOf((String) parser.attrs.get("y")).doubleValue());
                    v.is_crease = (((String) parser.attrs.get("is_crease")).compareTo ("true") == 0);
                    v.id = Integer.parseInt((String) parser.attrs.get("id"));
                } else if (tag.compareTo ("/vertex") == 0) {
                    v.poly = p;
                    if (p.points == null) {
                        p.points = v;
                    }
                    if (w != null) {
                        w.next = v;
                    }
                    w = v;
                    vertex_map.put (new Integer(v.id), v);
                    v = null;
                } else if (tag.compareTo ("fold") == 0) {
                    if (v != null) {
                        Fold f = new Fold (v, 0, 0);
                        f.level = Integer.parseInt((String) parser.attrs.get ("level"));
                        String sidx = (String) parser.attrs.get ("index");
                        if (sidx == null) {
                            // backwards compatibility - we used to not have
                            // index, and level was close
                            f.index = f.level;
                        } else {
                            f.index = Integer.parseInt(sidx);
                        }
                        v.fold = f;
                        int twin  = Integer.parseInt((String) parser.attrs.get ("twin"));
                        Vertex u = (Vertex) vertex_map.get (new Integer(twin));
                        if (u != null) {
                            f.twin = u.fold;
                            u.fold.twin = f;
                        }
                        if (f.level > fold_level) {
                            fold_level = f.level;
                        }
                        if (f.index > fold_index) {
                            fold_index = f.index;
                        }
                    } else {
                        trace ("ERROR: fold not in vertex");
                    }
                }
            }
        } catch (IOException e) {
            System.out.println (e);
        }

        // renumber polygons - make sure next_id doesn't overlap an existing
        // polygon!
        for (int i =0; i < polys.size(); i++) {
            getPoly (i).id = i;
        }
        Polygon.next_id = polys.size();
        zlevels = 1 << fold_level;
    }

    void step () {
        String line = script.read_line();
        if (line == null) {
            return;
        }
        // split not availble in earlier class library
        // String tokens[] = line.split (" ");
        String tokens[] = new String [1];
        System.out.println ("step " + line);
        if (tokens[0].startsWith("mouse")) {
            int x = Integer.parseInt(tokens[1], 10);
            int y = Integer.parseInt(tokens[2], 10);
            int nclick = Integer.parseInt(tokens[3], 10);
            if (tokens[0].equals("mousePressed")) {
                pane.mt.handleMousePress (x, y, nclick);
            } else {
                pane.mt.handleMouseRelease (x, y);
            }
        } else {
            pane.actions.runCommand (tokens[0]);
        }
    }

    static class CutfoldWindowListener implements WindowListener {
        Frame frame;
        CutfoldWindowListener (Frame frame) {
            this.frame = frame;
        }
        public void windowClosed (WindowEvent e) {
        }
        public void windowClosing (WindowEvent e) {
            frame.dispose();
        }
        public void windowActivated (WindowEvent e) {
        }
        public void windowDeactivated (WindowEvent e) {
        }
        public void windowDeiconified (WindowEvent e) {
        }
        public void windowIconified (WindowEvent e) {
        }
        public void windowOpened (WindowEvent e) {
        }
    }
}
