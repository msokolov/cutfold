/*
 * Polygon.java
 *
 * Created January, 2002
 *  copywrite (c) Mike Sokolov
 */

/**
 *
 * @author  sokolov
 * @version 1.0
 */

import java.awt.*;
import java.util.*;

public class Polygon 
    // not in Java 1:
    // implements Comparable 
{
    public Vertex points;
    int id;
    int z;
    java.awt.Color fgcolor;
    boolean faceup;

    // bounding box
    double left;
    double right;
    double top;
    double bottom;

    // These three flags are used to keep track of which polygons are to be
    // flipped when folding - we might combine them into a bit field...
    boolean flipme;
    boolean visited;
    boolean is_anchor;

    boolean flipped;

    public static int next_id = 0;

    private static int[] xpoints = new int[2048];
    private static int[] ypoints = new int[2048];
    // not in Java 1.1
    //private static Color defcolor = new Color(0xaaaaaaf8, true);
    private static Color defcolor = new Color(0xaaaaaa);
    private static Color crease_color = new Color(0x666688);
    private static Color colors[];

    public Polygon () {
        points = null;
        id = next_id++;
        z = 0;
        faceup = true;
        fgcolor = colors[id%10];

        flipme = false;
        visited = false;
        is_anchor = false;
    }

    public Polygon (Polygon p) {
        id = p.id;
        z = p.z;
        faceup = p.faceup;
        fgcolor = p.fgcolor;

        flipme = p.flipme;
        visited = p.visited;
        is_anchor = p.is_anchor;

        Vertex v = p.points;
        Vertex u = v.copy();
        points = u;
        for (;;) {
            // don't attempt to copy Folds
            v = v.next;
            if (v == p.points) {
                u.next = points;
                break;
            }
            Vertex u1 = v.copy();
            u.next = u1;
            u = u1;
        }
        setPointsPoly ();
    }

    public static void initColors () {
        // Initialize colors array
        colors = new Color[10];
        /*
        colors[0]= new Color(0x444433f8, true);
        colors[1]= new Color(0x554433f8, true);
        colors[2]= new Color(0x663344f8, true);
        colors[3]= new Color(0x446633f8, true);
        colors[4]= new Color(0x333366f8, true);
        colors[5]= new Color(0x666666f8, true);
        colors[6]= new Color(0x884488f8, true);
        colors[7]= new Color(0x992222f8, true);
        colors[8]= new Color(0x229922f8, true);
        colors[9]= new Color(0x222299f8, true);
        */
        // no transparency in Java 1.1
        colors[0]= new Color(0x444488);
        colors[1]= new Color(0x774477);
        colors[2]= new Color(0x663344);
        colors[3]= new Color(0x446633);
        colors[4]= new Color(0x333366);
        colors[5]= new Color(0x666666);
        colors[6]= new Color(0x884488);
        colors[7]= new Color(0x992222);
        colors[8]= new Color(0x229922);
        colors[9]= new Color(0x222299);
    }

    public Polygon similar () {
        // make a "similar' polygon
        Polygon new_poly = new Polygon ();
        new_poly.z = z;
        new_poly.faceup = faceup;
        new_poly.fgcolor = colors[new_poly.id % colors.length];
        return new_poly;
    }

    public void computeBoundingBox () {
        left  = 1000;
        right =-1000;
        top   = 1000;
        bottom=-1000;
        Vertex u = points;
        do {
            if (u.x < left) left = u.x;
            if (u.x > right) right = u.x;
            if (u.y > bottom) bottom = u.y;
            if (u.y < top) top = u.y;
            u = u.next;
        } while (u != null && u != points);
    }

    public void clearFlags () {
        flipme = false;
        visited = false;
        is_anchor = false;
        flipped = false;
    }

    public void draw (Graphics g, int xoff, int yoff, double scale, 
                      boolean show_vertices) {
        int n = 0;
        Vertex v = points;
        if (v == null)
            return;
        do {
            xpoints[n] = (int) Math.round(v.x * scale) + xoff;
            ypoints[n++] = (int) Math.round(v.y * scale) + yoff;
            v = v.next;
        } while (v != points);
        doDraw (g, n, show_vertices);
    }

    public void tween (Polygon p1, Graphics g, int xoff, int yoff, double scale, double t,
                       int rotation_style) {
        int n = 0;
        Vertex v = points, v1 = p1.points;
        double x, y, s;
        // 0 <= t <= 1; t' = (1-cos(PI * t))/2; 0<=t'<=1 also, but sinusoidally...
        s = (1 - Math.cos (t * Math.PI)) / 2;
        if (v == null || v1 == null)
            return;
        do {
            x = v.x + s * (v1.x - v.x);
            y = v.y + s * (v1.y - v.y);
            if (rotation_style != 0 && v.x != v1.x) {
                // perspective xform - vanishing point is 0,0 ; always the center of the screen
                // compute z using v.r which stores the distance of the point from an axis
                // about which it's being rotated
                // TBD - if the model is not centered on 0,0 we need to use its center as the 
                // vanishing point instead (can use model bounds)
                double z = (rotation_style == 2 ? (- v1.r) : Math.abs (v1.r));
                z *= Math.sin (t * Math.PI);
                x = 250 * x / (250 + z);
                y = 250 * y / (250 + z);
            }
            xpoints[n] = (int) Math.round(x * scale) + xoff;
            ypoints[n++] = (int) Math.round(y * scale) + yoff;
            v = v.next;
            v1 = v1.next;
        } while (v != points && v1 != p1.points);
        if (t < 0.5) {
            doDraw (g, n, false);
        } else {
            // get the color right
            p1.doDraw (g, n, false);
        }
    }

    private void doDraw (Graphics g, int n, boolean show_vertices) {
        g.setColor (faceup ? colors[z % colors.length] : defcolor);
        g.fillPolygon (xpoints, ypoints, n);

        xpoints[n] = xpoints[0];
        ypoints[n] = ypoints[0];
        int i = 0;
        Vertex v = points;
        g.setColor (Color.black);
        do {
            if (! v.is_crease) {
                g.drawLine (xpoints[i], ypoints[i], xpoints[i+1], ypoints[i+1]);
            } 
            else if (true) {
                // show creases for diagnostic purposes:
                g.setColor (crease_color);
                g.drawLine (xpoints[i], ypoints[i], xpoints[i+1], ypoints[i+1]);
                g.setColor (Color.black);
            }
            // show vertices for diagnostic purposes:
            if (show_vertices) {
                g.drawRect (xpoints[i]-1, ypoints[i]-1, 2, 2);
                g.drawString ((new Integer(i)).toString(), xpoints[i]-4 * i, ypoints[i]+12);
            }
            v = v.next;
            ++i;
        } while (v != points && i < n);
    }


    public int compareTo (Object other) throws ClassCastException {
        Polygon otherp = (Polygon) other;
        // higher z is further away from viewer (polys w/lower z obscure those w/higher)
        return otherp.z - z;
    }

/*
 * fold splits a polygon in two with a line segment, creating a new polygon, modifying
 * this polygon and connecting the two with a pair of twinned folds.
 */

    public void fold (Vertex v, Vector new_polys, 
                      int fold_level, int fold_index) {
        Vector intersections = intersect (v, null);
        if (intersections.size() < 2) {
            return;	// Ignore snips into the interior that leave the polygon hole
        }
        boolean inp = contains(v);
        if (inp && intersections.size() < 3) {
            return;	// Ignore snips from the interior to the interior that never
            // leave the polygon 
        }
        if (inp) {
            // ignore the first intersection since it's just incidental if we started 
            // inside the polygon
            intersections.removeElementAt(0); // TBD delete me?
        }
        while (intersections.size() > 1)
        {	 
            /* Create a new poly from one side of the fold. In the new
               poly, the dividing edge contains the points b, a in the sequence:
               b0->b->a->a.next.  Also modify the existing poly to contain the new
               edge in the sequence: a0->a->b->b0.next */
            Intersection a_int = (Intersection) intersections.elementAt(0);
            intersections.removeElementAt(0);
            Vertex a = a_int.pt, a0 = a_int.edge;
            Fold fa = a0.fold;
		 
            Intersection b_int = (Intersection) intersections.elementAt(0);
            intersections.removeElementAt(0);
            Vertex b = b_int.pt, b0 = b_int.edge;
            Fold fb = b0.fold;
		 
            Polygon p1 = similar ();

            // clone b and a for the new poly and set up the fold structure linking them
            // and their polygons together
            Vertex b1 = b.copy ();
            Vertex a1 = a.copy ();
            // TBD - we used to record b in this fold as v2?
            Fold f = new Fold (a, fold_level, fold_index);
            a.fold = f; 
            // TBD - we used to record a1 in this fold as v2?
            Fold f1 = new Fold (b1, fold_level, fold_index);
            b1.fold = f1; 
            f1.twin = f;
            f.twin = f1;

            // relink the points to form p1
            b1.next = a1;
            a1.next = a0.next;
            b.next = b0.next; // part of p, not p1 - but do it now to avoid losing the link
            b0.next = b1;
            p1.points = b1;
            new_polys.addElement (p1);
		 
            // hook up the p points
            a0.next = a;
            a.next = b;
            points = a;  // may be redundant, but sometimes needed...
		 
            // set the poly links of all the points in p and p1
            setPointsPoly ();
            p1.setPointsPoly ();
		 
            // mark these polys as having determinate flippedness
            p1.is_anchor = true;
            is_anchor = true; 
			 
            // determine which poly is on the right hand side of the fold and mark it.
            if (faceup) {
                flipme = true;
            } else {
                p1.flipme = true;
            }
            if (fa != null) {
                fa.fold (a, a1); // split the fa fold in two
            }
            if (fb != null) {
                fb.fold (b1, b); // split the fb fold in two
            }
        }
    }

    public void cut (Polygon pcut, Vector new_polys, Vector cut_folds) {
        // see if v is inside p (and remember a "nearby" intersection)
        boolean inside, start_inside, pcut_enclosed;
        Vector outer_xings;
        /* In order to cut this polygon, pcut must enter and leave the polygon
         */
        start_inside = inside = encloses (pcut.points);
        Vector xings = new Vector ();
        // OK umm we really need to check whether any of the cutting polygon's 
        // edges intersect any of this polygon's edges.  Only if the cutting 
        // polygon is completely enclosed in this polygon do we need to 
        // create a pseudo-edge as we do below:
        pcut_enclosed = false;
        if (inside) {
            if (!intersectsPoly (pcut)) {
                // find the nearest point on the perimiter of this polygon 
                // to the interior point v, and begin cutting from there.
                Vertex v = new Vertex (pcut.points.x, pcut.points.y);
                Vertex ep [] = new Vertex [1];
                near (v.x, v.y, null, v, 100, ep);
                xings.addElement (new Intersection (v, ep[0], 0, true));
                v = pcut.points;
                xings.addElement (new Intersection (v, null, 0, false));
                pcut_enclosed = true;
            } else {
                // This code was originally written with the assumption
                // we would always begin and end cutting outside the
                // polygon.  So handling cuts where pcut.points is in
                // our interior is a little messy.  We first tried rotating
                // pcut in order to start at an outside point
                //
                // However this sometimes fails into an inf. loop
                // There are polygons that intersect where all the vertexes
                // of one are inside the other. (see bug5.txt)
                // In that case we can find an intersection, save it and
                // start at the next interior point.
                //
                // Q: Is there going to be a problem caused by modifying
                // the starting point of the cutting poly differently in
                // subsequent invocations of this function?  I think we used
                // to rely on matching data structures, but now we use enough
                // geometry in the patching code to be resilient to this...
                Vector vxings = null;
                while (vxings == null && pcut.points.next != null) {
                    vxings = intersect (pcut.points, null);
                    if (vxings.size() == 0) vxings = null;
                    pcut.points = pcut.points.next;
                } 
                if (vxings.size() % 2 == 1) {
                    // If there are an odd number of intersections, we found a
                    // point on pcut outside the polygon, so just start there.
                    inside = false;
                } else {
                    // We only keep the last intersection if there are several
                    // since the others will be rediscovered as we loop back
                    // around pcut
                    while (vxings.size() > 1) {
                        vxings.removeElementAt (0);
                    }
                    xings.addElement (vxings.elementAt (0));
                    xings.addElement 
                        (new Intersection (pcut.points, null, 0, false));
                }
            }
        }
        // For each line segment in pcut,
        // check for intersections with this polygon.
        Vertex v = pcut.points;
        do {
            // Check for intersections with this poly and any new polys 
            // created by cutting it with a previous edge of pcut.
            Vector vxings = intersect (v, null);
            for (int i = 0; i < new_polys.size(); i++) {
                Polygon q = (Polygon) new_polys.elementAt(i);
                vxings = q.intersect (v, vxings);
            }
            // Add the intersections to the xings Vector, keeping track of whether we're inside
            // or outside the set of polygons {this, { new_polys } }
            while (vxings.size () > 0) {
                Intersection xing = (Intersection) vxings.elementAt(0);
                vxings.removeElementAt(0);
                if (xing.t < 0.02) {
                    // the xing is right at v
                    inside = faceup ? (xing.pt.r > 0) : (xing.pt.r <= 0);
                } else if (xing.t > 0.98) {
                    // The xing is right at v.next ignore the endpoint unless it's the
                    // last of pcut; otherwise it'll be the same as the next v.
                    if (v.next.next != null) {
                        xing = null;
                    }
                    if (vxings.size() > 0) {
                        System.out.println 
                            ("intersections not sorted as we thought?  This should be the last one...\n");
                    }
                    // Don't treat v.next as an interior point when it lies on the 
                    // polygon's edge.  Basically think of the cutting edge as a half-open
                    // interval
                    inside = false;
                } else {
                    inside = ! inside;
                }
                if (xing != null) {
                    xings.addElement (xing);
                }
            }
            if (inside) {
                // no "edge" indicates this is not an intersection, but a new 
                // interior point.  Be sure to copy the point because it will be 
                // incorporated into a new polygon and can't be shared by several
                if (v.next == pcut.points) {
                    xings.addElement 
                        (new Intersection (v.next.copy(), null, 0, true));
                    if (pcut_enclosed) {
                        // If the last point is inside, and this polygon
                        // completely encloses pcut, append the nearest edge
                        // point.  Note: if pcut is not enclosed, it means
                        // that it crosses this polygon somewhere and we 
                        // don't need to do this.
                        Vertex w = new Vertex (v.next.x, v.next.y);
                        Vertex ep [] = new Vertex [1];
                        near (w.x, w.y, null, w, 100.0, ep);
                        xings.addElement (new Intersection (w, ep[0], 1.0, false));
                    }
                    // set flag to call cutSegment in next block
                    inside = false;
                } else {
                    xings.addElement (new Intersection (v.next.copy(), null, 0, false));
                }
            }
            if (! inside) {
                while (xings.size() >= 2) {
                    Intersection xing = (Intersection) xings.elementAt(0);
                    if (xing.edge == null) {
                        // discard external vertices
                        xings.removeElementAt(0);
                        continue;
                    }
                    xing.edge.poly.cutSegment (xings, new_polys, cut_folds);
                }
            }
            v = v.next;
            if (!inside && !start_inside && v.next == pcut.points) {
                // skip the implicit cutting segment between the
                // user's double click and their first click
                // if both lie outside this polygon.
                break;
            }
        } while (v.next != null && v != pcut.points);
        setPointsPoly ();
        for (int i = 0; i < new_polys.size(); i++) {
            Polygon p = (Polygon) new_polys.elementAt(i);
            p.setPointsPoly ();
        }
    }

    public void cutSegment (Vector xings, Vector new_polys, Vector cut_folds) {
        Vertex a = null, b = null, a0 = null, b0 = null, a_last = null;
        Vertex b_last = null, e, e0 = null;
        boolean done = false;
        // loop over all intersections and internal points, creating new polygons
        // out of pieces of p.
        Intersection xing = null;
        while (xings.size() > 0 && !done)
        {
            xing = (Intersection) xings.elementAt(0);
            xings.removeElementAt(0);
            a = xing.pt.copy ();
            b = a.copy ();
            a.is_crease = xing.is_crease;
            if (a0 == null) {
                a0 = a;
                b0 = b;
                e0 = xing.edge;
            } else {
                b.is_crease = a_last.is_crease;
                a_last.next = a;
                b.next = b_last;
                if (xing.edge != null)
                    done = true;
            }
            a_last = a;
            b_last = b;
        }
        // Sometimes we get called with a bogus trailing incomplete cutting 
        // segment that terminates inside the polygon (a snip) - ignore
        // these.
        if (! done) 
            return;

        // now close off the polygons depending on the relationship of the entry
        // and exit points - there are three cases:

        e = xing.edge;  /* (e, e.next) = intersected edge of p */
        Polygon p1 = similar ();
        new_polys.addElement (p1);

        Fold f = e.fold;

        if (e != e0)
        {   // We entered and exited on different edges.
            // Remember the salient points on the folded edges - before losing
            // the links e/e.next and e0/e0.next
            if (f != null) {
                f.pushCutFoldPoint (a, faceup ? cut_folds : null);
                a.fold = f;
            }
            if ((f = e0.fold) != null) {
                f.pushCutFoldPoint (b0, faceup ? cut_folds : null);
                b0.fold = f;
            }
            // close off the polygons
            b0.next = e0.next;
            e0.next = a0;
            a.next = e.next;
            e.next = b;
        } 
        else                        /* a0,b0 and a,b are on the same edge */
        {
            // If a is further from e0 than a0 then the b's form their own 
            // entirely new polygon, while the a's are connected to the points
            // of the original p.
            boolean a_same_spin, degenerate = false;
            double a_dist = (Math.abs(a.x-e0.x) + Math.abs(a.y-e0.y));
            double a0_dist = (Math.abs(a0.x-e0.x) + Math.abs(a0.y-e0.y));
            if (a_dist > a0_dist + 0.01) {
                a_same_spin = true;
            }
            else if (a0_dist > a_dist + 0.01) {
                a_same_spin = false;
            } else {
                // Actually what's really at issue is whether the new polygon
                // has been laid out CW or CCW.  Now that we allow internal
                // polygons a degenerate case arises in which a=a0, and the
                // original test (which of a or a0 is closer to e0) no longer
                // suffices to determine that.  We can determine this by
                // the formula below:
                degenerate = true;
                double cpsum = 0;
                a_last = a0.next;
                Cutfold.trace (a_last.x +","+a_last.y);
                for (e=a_last.next; e != null && e.next != a; e=e.next) {
                    /*
                    Cutfold.trace (e.x +","+e.y);
                    cpsum += ((e.x - a_last.x) * (e.next.y - e.y)) 
                        - ((e.next.x - e.x) * (e.y - a_last.y));
                    */
                    cpsum += (e.y * a_last.x) - (e.x - a_last.y);
                    a_last = e;
                }
                // If this polygon is faceup it's CCW.
                // If cpsum > 0 the "a" polygon is CCW 
                a_same_spin = ((cpsum < 0) ^ faceup);
                Cutfold.trace ("cpsum=" + cpsum + " same_spin=" + a_same_spin);
            }
            if (a_same_spin)
            {
                // b's form the new polygon; a's become part of this polygon
                a.next = e0.next;
                b0.next = b;
                e0.next = a0;
            }
            else {
                // a's form the new polygon; b's become part of this polygon
                a.next = a0;
                b0.next = e0.next;
                e0.next = b;
            }
            if (f != null) {
                if (degenerate) {
                    // in this case don't map the fold to the new polygon's
                    // degenerate edge
                    if (a_same_spin) {
                        a.fold = f;
                        f.pushCutFoldPoint (a, faceup ? cut_folds : null);
                    } else {
                        b0.fold = f;
                        f.pushCutFoldPoint (b0, faceup ? cut_folds : null);
                    }
                } else {
                    a.fold = f;
                    b0.fold = f;
                    f.pushCutFoldPoint (b0, faceup ? cut_folds : null);
                    f.pushCutFoldPoint (a, null);
                }
            }
        }

        points = a;
        setPointsPoly();

        p1.points = b;
        p1.setPointsPoly();
    }

    public void setPointsPoly () {
        Vertex u = points;
        do {
            u.poly = this;
            u = u.next;
        } while (u != points);
    }

    /* markFoldedPolys 
       Walks the polygon graph, marking all polygons that
       can be reached without crossing the fold cohort indicated by
       fold_index.  */

    public void markFoldedPolys (int fold_index, Polygon parent) {
        if (visited) {
            return;   // stop this thing from going on forever
        }
        visited = true;
        flipme = true;
        // System.out.println ("markFolded Poly p " + id);
        Vertex v = points;
        do {
            Fold f = v.fold; 
            Polygon p1;
            if ((f != null) && ((p1 = f.twin.v.poly) != parent))
            {
                if (f.index != fold_index) {
                    // don't cross the fold 
                    p1.markFoldedPolys (fold_index, this);
                }
            }
            v = v.next;
        } while (v != points);
    }

/* markPolyGraph
  * Walk a graph of polys, following fold_poly links, setting each polygon's
  * flipme flag so as to indicate its side of the fold_index cohort of folds
  */
  
    public void markPolyGraph (boolean flipping, Polygon parent, 
                               int fold_index) {
        if (visited) {
            return;   // stop this thing from going on forever
        }
        visited = true;
        if (is_anchor) {
            // The newly split polygons are like islands of certainty in a sea of doubt...
            flipping = flipme;
        } else {
            flipme = flipping;
        }
        // System.out.println ("markPolyGraph p" + id + (flipme ? " x " : " o "));
        Vertex v = points;
        do {
            // recurse through folds, including the current one.
            // the parent test is not strictly necessary - 
            // it just saves some useless recursions
            Fold f = v.fold; 
            Polygon p1;
            if ((f != null) && ((p1 = f.twin.v.poly) != parent))
            {
                if (f.index == fold_index) {
                    // change flipping when crossing the fold 
                    p1.markPolyGraph (!flipping, this, fold_index);
                } else {
                    p1.markPolyGraph (flipping, this, fold_index);
                }
            }
            v = v.next;
        } while (v != points);
    }

/* ============================================================================= */
/*                                   GEOMETRY                                    */
/* ============================================================================= */

public boolean intersectsPoly (Polygon p) {
    Vertex u = points;
    do {
        Vertex v = p.points;
        do {
            if (u.intersectTest (v)) {
                return true;
            }
            v = v.next;
        } while (v != null && v != p.points);
        u = u.next;
    } while (u != null && u != points);
    return false;
}

/*
 * contains
 *  returns a boolean indicating whether a point lies inside a polygon.  
 *  Determined by drawing a line from a point known to be outside the 
 *  polygon to the point in question.
 *  If the number of intersections of the resulting line segment with the 
 *  polygon is odd, then the point lies inside the polygon, 
 *  otherwise it's outside.
 */
 
    public boolean contains (Vertex v) {
        if (v.x < left || v.x > right || v.y < top || v.y > bottom)
            return false;
        Vertex vout = new Vertex (-200, -200);
        vout.next = v;
        Vertex u = points;
        int intCount = 0;
        do { 
            if (vout.intersectTest (u)) {
                ++intCount;
            }
            u = u.next;
        } while (u != points);
        return intCount % 2 == 1 ;
    }

    public boolean encloses (Vertex v) {
        // This is just like contains, but returns false if v lies on
        // or very near an edge of the Polygon
        if (near (v.x, v.y, v.next, null, 0.1, null) < 0.0001) {
            return false;
        }
        return contains (v);
    }

    /*
     * near
     * a point is near a polygon if it is within min_dist of one of the 
     * polygon's edges.  near returns the distance of the nearest point on the 
     * polygon's perimeter to the point x,y that is less than min_dist.
     * In the case that such a point is found, it is returned in v.
     * If there is no such point, near returns min_dist unchanged.
     */
    public double near (double x, double y, Vertex next,
                        Vertex v, double min_dist, Vertex [] ep) {
        if (x < left - min_dist || x > right + min_dist ||
            y < top - min_dist || y > bottom + min_dist) 
            return min_dist;
        Vertex u = points;
        do {
            double ux = u.next.x - u.x;
            double uy = u.next.y - u.y;
            double vx = x - u.x;
            double vy = y - u.y;
            double uv = (ux*vx + uy*vy);
            double u2 = (ux*ux + uy*uy);
            double v2 = (vx*vx + vy*vy);
            double t =  uv / u2;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
            // sometimes numerical error causes the operand of sqrt
            // to be slightly negative when the theoretical value should be 
            // zero so we need to take the abs first
            double d = Math.sqrt (Math.abs(v2 - t * uv));
            if (d < min_dist) {
                if (v != null) {
                    v.x = u.x + t * ux;
                    v.y = u.y + t * uy;
                    if (next != null) {
                        v.r = (next.x - x) * uy  - ux * (next.y - y);
                    } else {
                        v.r = 0;
                    }
                    // The sign of (next.x - x) * uy  - ux * (next.y - y) indicates
                    // whether (x,y)->next is headed in or out of the poly
                }
                min_dist = d;
                if (ep != null)
                    ep[0] = u;
            }
            u = u.next;
        } while (u != points);
        return min_dist;
    }

/*
 * intersect
 *   Returns a Vector of intersections of a line segment and a polygon,
 *   sorted by distance from the start point of the line segment.
 *   If the result argument is not null, intersections are added to it.  It is assumed
 *   to be sorted.
 *   The array contains objects (Intersections) with three elements; 
 *   pt: the point of intersection
 *   edge: the first point on the polygon of the edge on which the intersection lies.
 *   t: parameter values of the line equation (v1 + t *(v2-v1)); used to order the points
 *   If there is no intersection, an empty list is returned.
 */

    public Vector intersect (Vertex v, Vector result) {
        if (result == null)
            result = new Vector ();
        double param[] = new double [1];
        Vertex u = points;
        do { 
            Vertex w = v.intersectEdges (u, param);
            if (w != null) {
                int i;
                for (i=0; i<result.size(); i++) {
                    if (((Intersection)result.elementAt(i)).t > param[0]) {
                        break;
                    }
                }
                result.insertElementAt (new Intersection (w, u, param[0], false), i);
            }
            u = u.next;
        } while (u != points);
        return result;
    }
 
    public boolean overlaps (Polygon p) {
        return (left <= p.right && p.left <= right &&
                top <= p.bottom && p.top <= bottom) ;
    }

    public void compute_axis_distances (Affine axis) {
        Vertex v = points;
        do {
            v.r = axis.distance (v.x, v.y);
            // System.out.println ("r=" + v.r);
            v = v.next;
        } while (v != points);
    }

/* reflect
  * reflect the polygon about the edge v1=>v2, set the z value and flip the
  * polygon's orientation.
  */
  
    public void reflect (Vertex v1, Vertex v2, int zlevels) {
        // System.out.println ("reflect p " + id);
        double d2 = v1.distanceSquared (v2);
        if (d2 <= 0.01) return;
        double x21 = v2.x - v1.x;
        double y21 = v2.y - v1.y;
        Vertex v = points;
        do {
            // loop over all the points in the polygon , compute the value of t
            // that describes the closest point on the edge (v1, v2) to the
            // Vertex v, where the line is written v1 + t(v2-v1).  Then the new
            // reflected Vertex v' is 2 (v1 + t(v2-v1)) - v
            //
            // however if the point lies on the reflection edge then skip it

            if (v == v1 || v == v2) {
                v = v.next;
                continue;
            }
            double t = ((v.x - v1.x) * x21 + (v.y - v1.y) * y21) / d2;
            v.x = 2 * (v1.x + t * (v2.x - v1.x)) - v.x;
            v.y = 2 * (v1.y + t * (v2.y - v1.y)) - v.y;
            v = v.next;
        } while (v != points);
        z = zlevels - z - 1;    // reflect the z-value about the midpoint
        if (z < 0) { z = 0; }   // I think we have an error condition somewhere...
        faceup = !faceup;       // flip the poly over
    }

    static void sort (Vector polys, boolean ascending) {
        //  not in java 1:
        // Collections.sort (polys);
        for (int i = 0; i < polys.size()-1; ) {
            Polygon a = (Polygon) polys.elementAt(i);
            Polygon b = (Polygon) polys.elementAt(i+1);
            if (ascending ? (a.z > b.z) : (a.z < b.z)) {
                polys.setElementAt (b, i);
                polys.setElementAt (a, i+1);
                if (i > 0)
                    --i;
            } else {
                ++i;
            }
        }
        
    }

    String xml () {
        String xml = "<polygon id=\"" + id + "\" faceup=\"" + 
            faceup + "\" z=\"" + z + "\">";
        Vertex u = points;
        do {
            xml += "\n  " + u.xml();
            u = u.next;
        } while (u != points);
        xml += "\n</polygon>";
        return xml;
    }
}
