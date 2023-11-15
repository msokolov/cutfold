/*
 * fold.js
 *
 *  copyright (c) 2003, 2013 Mike Sokolov
 */

function Fold (v, level, index) {
    // A vertex representing an edge, part of a polygon, that marks the fold
    this.v = v;

    // describes nestedness of this fold.  Used when unfolding to determine
    // which polygons to unfold based on their z value.  Possibly could also
    // be done topologically using index?
    this.level = level;

    // index uniquely identifies a cohort of folds.  It is used to mark
    // the polygon graph to identify all polygons on either side of a fold
    this.index = index;

    this.twin = null;
    this.other_twin = null;
    this.cut_points = null;
}

Fold.prototype.fold = function (a, a1) {
    // split this fold in two - fold it again along the edge defined by a, a1
    var f1 = new Fold (a1, this.level, this.index);
    a1.fold = f1;
    if (this.other_twin != null) {
        // There are two folds that are our twin - make one of them be
        // twinned with the new fold, and of them stays with us
        f1.twin = this.twin;
        this.twin = this.other_twin;
        f1.twin.twin = f1;
        this.other_twin = null;
    } else {
        // begin mitosis or is it meiosis?
        // For now both we and the new fold have the same twin; leave a record
        // of f1 in the twin so it can patch itself up later when split (see above).
        f1.twin = this.twin;
        this.twin.other_twin = f1;
    }
}

// THIS FUNCTION (unfold) NOT CURRENTLY IN USE
// It was doing surgery to completely erase the effect of folding (no creases
// left behind) and at some point we replaced it with Cutofld.unfold_once,
// which leaves invisible creases behind
Fold.prototype.unfold = function () {
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
    var e = this.v;
    var p = e.poly;
    var e1 = this.twin.v;
    var p1 = e1.poly;
    // System.out.println ("removeFold " + p.id + " merging with " + p1.id);
    var ep = e.findPrev ();
    var e1p = e1.findPrev ();
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

Fold.prototype.mark_creases = function () {
    // All the edges that are part of this fold level are now creases
    var e = this.v;
    do {
        if (e.fold != null && e.fold.index == this.index) {
            e.is_crease = true;
            e.fold.level = 0;
        }
        e = e.next;
    } while (e != this.v);
    this.level = 0;
}

Fold.prototype.pushCutFoldPoint = function (v, cutfolds) {
    if (this.cutpoints == null) {
        this.cutpoints = []
        if (cutfolds != null) {
            cutfolds.push (this);
        }
    }
    this.cutpoints.push (v);
}

/* patchCut matches up newly created folds that have been created by cutting. */
Fold.prototype.patchCut = function () {
    while (this.cutpoints.length > 0) {
        var v0 = this.cutpoints.pop();
        var v1;
        if (this.twin.v.near(v0.next)) {
            // the start point of the original uncut folded edge f1
            // is added implicitly
            v1 = this.twin.v;
        } else {
            // search for the matching point in f1's cutpoints
            var i; 
            v1 = null;
            for (i=0; i<this.twin.cutpoints.length; i++) {
                v1 = this.twin.cutpoints[i];
                if (v1.near(v0.next)) {
                    this.twin.cutpoints.splice (i, 1);
                    break;
                }
            }
        }
        this.addCutFold (v0, v1);
    }
    if (this.twin.cutpoints.length > 0) {
        // the start point of the original uncut folded edge f 
        // is added implicitly   
        var v1 = this.twin.cutpoints.shift();
        this.addCutFold (this.v, v1);
    }
}

Fold.prototype.addCutFold = function (v1, v2) {
    var ff1 = new Fold (v1, this.level, this.index);
    v1.fold = ff1;

    var ff2 = new Fold (v2, this.twin.level, this.twin.index);
    v2.fold = ff2;

    ff1.twin = ff2;
    ff2.twin = ff1;
}
