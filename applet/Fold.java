/*
 * Fold.java
 *
 * Created January, 2003
 *  copywrite (c) Mike Sokolov
 */

/**
 *
 * @author  sokolov
 * @version 1.0
 */

import java.awt.*;
import java.util.*;

public class Fold {

    public Vertex v;

    // describes nestedness of this fold.  Used when unfolding to determine
    // which polygons to unfold based on their z value.  Possibly could also
    // be done topologically using index?
    public int level;

    // index uniquely identifies a cohort of folds.  It is used to mark
    // the polygon graph to identify all polygons on either side of a fold
    public int index;

    public Fold twin;
    public Fold other_twin;     // used temporarily during folding
    public Vector cutpoints;

    Fold (Vertex v, int level, int index) {
        this.v = v;
        this.level = level;
        this.index = index;
    }

    public void fold (Vertex a, Vertex a1) {
        // split this fold in two
        Fold f1 = new Fold (a1, level, index);
        a1.fold = f1;
        if (other_twin != null) {
            // There are two folds that are our twin - make one of them be
            // twinned with the new fold, and of them stays with us
            f1.twin = twin;
            twin = other_twin;
            f1.twin.twin = f1;
            other_twin = null;
        } else {
            // begin mitosis or is it meiosis?
            // For now both we and the new fold have the same twin; leave a record
            // of f1 in the twin so it can patch itself up later when split (see above).
            f1.twin = twin;
            twin.other_twin = f1;
        }
    }

    // THIS FUNCTION (unfold) NOT CURRENTLY IN USE
    public void unfold () {
        /*
          Called when unfolding; removes the fold, its twin, any other folds in their
          cohort (these are folds associating the same two polygons), all those folds
          vertices and merges the two polygons linked lists, eliminating twin's poly.
          Has the effect of undoing the topological folding operation; unfolding, 
          without the geometrical transformation.

          This function singles out one of the folds in the cohort and deletes its points
          and fold structure.  Other (secondary) folds are preserved as creases so that internal
          holes can be represented.  However the global fold structure is compromised because
          our caller doesn't ensure that other pairs of polygons make the same choice of primary fold.
         */
        Vertex e = v;
        Polygon p = e.poly;
        Vertex e1 = twin.v;
        Polygon p1 = e1.poly;
        // System.out.println ("removeFold " + p.id + " merging with " + p1.id);
        Vertex ep = e.findPrev ();
        Vertex e1p = e1.findPrev ();
        // System.out.println ("removeFold " + p.id + " merging with " + p1.id);
        // System.out.println ("  e=(" + e.x + ","+e.y+"), e1=(" + e1.x+","+e1.y+")");

        // remove e and e1 by joining ep to e1.next.next and e1p to e.next.next if 
        // the points are colinear
        ep.join (e1.next);
        e1p.join (e.next);

        // fix poly.points in case it was removed
        p1.points = e1p;
        p1.setPointsPoly ();          /* get rid of p by unlinking */
        p.points = null;           /* and marking for later removal */

        e = e1p; 
        do {
            // Loop through all of the vertices of my Polygon.  Operate on all
            // those that mark a fold in my cohort (those that were created when I was)
            // This takes care of the fact that folds can get cut in half; so we handle all of
            if (e.fold != null) {
                e1 = e.fold.twin.v;
                if (e1.fold.twin.v != e) {
                    System.out.println ("fold mismatch in Fold.unfold");
                }
                if (e1.poly == p || e1.poly == p1) {
                    // System.out.println ("removing secondary fold in Fold.unfold");
                    // e1 must be another segment of the fold we are removing
                    // if it connects p and p1, so delete the folds associated 
                    // with e and e1, which are now just a (pair of) internal edges;
                    // a slice connecting an interior hole with the exterior, 
                    // Or in the degenerate case (no hole), remove the edges themselves.
                    // TBD: handle cases where the degenerate crease has more than
                    // one pair of edges
                    // System.out.println ("secondary fold:  e=(" + e.x + ","+e.y+"), e1=(" + e1.x+","+e1.y+")");
                    if (e.next == e1) {
                        // System.out.println ("  remove e1.next");
                        e.next = e1.next.next;
                        e.fold = null;
                    } else if (e1.next == e) {
                        // System.out.println ("  remove e.next");
                        e1.next = e.next.next;
                        e1.fold = null;
                    } else {
                        // System.out.println ("  creating crease");
                        e.fold = null;
                        e.is_crease = true;
                        e1.fold = null;
                        e1.is_crease = true;
                    }
                }
            }
            e = e.next;
        } while (e != e1p);
    }

    public void mark_creases () {
        // All the edges that are part of this fold level are now creases
        Vertex e = v;
        do {
            if (e.fold != null && e.fold.index == index) {
                e.is_crease = true;
                e.fold.level = 0;
            }
            e = e.next;
        } while (e != v);
        level = 0;
    }

    public void pushCutFoldPoint (Vertex v, Vector cutfolds) {
        if (cutpoints == null) {
            cutpoints = new Vector ();
            if (cutfolds != null)
                cutfolds.addElement (this);
        }
        cutpoints.addElement (v);
    }

    /* patchCut matches up newly created folds that have been created by cutting. */
    public void patchCut () {
        while (cutpoints.size() > 0)
        {
            Vertex v0 = (Vertex) cutpoints.elementAt (cutpoints.size()-1);
            cutpoints.removeElementAt (cutpoints.size()-1);
            Vertex v1;
            if (twin.v.eq (v0.next)) {
                // the start point of the original uncut folded edge f1
                // is added implicitly
                v1 = twin.v;
            } else {
                // search for the matching point in f1's cutpoints
                int i; 
                v1 = null;
                for (i=0; i<twin.cutpoints.size(); i++) {
                    v1 = (Vertex) twin.cutpoints.elementAt (i);
                    if (v1.eq(v0.next)) {
                        twin.cutpoints.removeElementAt (i);
                        break;
                    }
                }
            }
            addCutFold (v0, v1);
        }
        if (twin.cutpoints.size() > 0) {
            // the start point of the original uncut folded edge f 
            // is added implicitly   
            Vertex v1 = (Vertex) twin.cutpoints.elementAt (0);
            twin.cutpoints.removeElementAt (0);
            addCutFold (v, v1);
        }
    }

    public void addCutFold (Vertex v1, Vertex v2) {
        Fold ff1 = new Fold (v1, level, index);
        v1.fold = ff1;

        Fold ff2 = new Fold (v2, twin.level, twin.index);
        v2.fold = ff2;

        ff1.twin = ff2;
        ff2.twin = ff1;
    }
}
