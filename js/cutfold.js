/*
 * Cutfold.js
 * Paper-folding applet ported to js
 *
 * Version 2.0 November 2013
 *  Mike Sokolov (sokolov@falutin.net)
 */

var cutfold;

function init(params) {
    cutfold = new Cutfold(params);
    cutfold.init();
}

function Cutfold(params) {
    this.polys = [];
    this.polys_undo_copy = [];
    this.poly_tween_copy = [];

    this.tween_map = [];
    this.tween_map_has_dest = false;

    this.debug = false;
    this.params = params || {};

    this.tween_axis = {}, // Affin;
    this.rotation_style = 0, // 0 - none, 1 - rotate behind, 2- rotate left to righ;

    // bounding box -- replaced by canvas.offsetTop, etc
    this.left = 0;
    this.top = 0; 
    this.right = 0;
    this.bottom = 0;

    // scaling transform
    this.xoff = 0;
    this.yoff = 0;
    this.xoff_target = 0;
    this.yoff_target = 0;
    this.xoff_start = 0;
    this.yoff_start = 0;
    this.scale_timer = 0;
    this.scale_time = 0;
    this.scale = 1.0;
    this.scale_target = 0;
    this.scale_start = 0;

    this.zlevels = 0;
    this.zlevels_copy = 0;
    this.fold_level = 0;
    this.fold_level_copy = 0;
    this.fold_index = 0;
    this.fold_index_copy = 0;

    // TODO Polygon class:
    // this.pcut =  new Polygon();
    this.mode =  "";

    // TODO markup:
    // undo_btn, fold_btn, cut_btn;
    // TextField caption;

}

Cutfold.prototype.init = function () {
    console.debug ('params.model=' + this.params.model);
    this.debug = this.params.debug;
    this.canvas = document.getElementById ("cutfold");
    this.setupCanvas (this.canvas);
    this.panel = new Panel (this, this.canvas, this.showguides, this.readonly);

    // TODO: implement these as classes on the canvas specified in markup
    // params.showGuidelines
    // params.readonly

    this.reset ();
}

Cutfold.prototype.setupCanvas = function (canvas) {
    var cutfold = this;
    window.onresize = function () {
        // console.debug ("resize window(" + window.innerWidth + "," + window.innerHeight + ")");
        //canvas.setLocation (0, 0);
        var w = window.innerWidth - (2*canvas.offsetLeft);
        var h = window.innerHeight - (2*canvas.offsetTop);
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = w;
        canvas.style.height = h;
        cutfold.rescale_canvas (canvas, 0, true);
    }
}

Cutfold.prototype.rescale_canvas = function (canvas, delay, repaint) {
    // get the w,h of the paper model
    var w = this.right - this.left;
    var h = this.bottom - this.top;
    if (w == 0 || h == 0) {
        return;
    }
    console.debug ("rescale_canvas: (" + canvas + "," + w + "," + h +")");
    /*
    var left = canvas.offsetLeft;
    var top = canvas.offsetTop;
    */
    console.debug (this.left + this.right);
    var cx = (this.left + this.right) / 2;
    var cy = (this.bottom + this.top) / 2;
    this.scale_target = w > h ? (400 / w) : (400 / h);
    console.debug (this.left + "," + this.right + ": " + cx);
    this.xoff_target = Math.floor(canvas.width/2 - Math.round(cx * this.scale_target));
    this.yoff_target = Math.floor(canvas.height/2 - Math.round(cy * this.scale_target));
    this.scale_start = this.scale;
    this.xoff_start = this.xoff;
    this.yoff_start = this.yoff;
    // when drawing, transform points from model space to screen
    // space by (x,y)*scale + (xpos, ypos)
    this.scale_timer = new Date().getTime();
    this.scale_time = delay;
    console.debug ("xoff="+this.xoff+", yoff="+this.yoff+" scale="+this.scale);
    console.debug ("target xoff="+this.xoff_target+", yoff="+this.yoff_target+" scale="+this.scale_target);
    if (repaint) {
        this.repaint ();
    }
}

Cutfold.prototype.repaint = function () {
    this.canvas.width = this.canvas.width; // clear
    this.panel.paint ();
}

Cutfold.prototype.reset = function () {
    this.polys = [];
    this.polys_undo_copy = null;
    this.polys_tween_copy = null;
    this.tween_axis = null;
    this.rotation_style = 0;

    this.xoff = this.yoff = 0;
    this.scale = 1.0;
    this.scale_timer = 0;

    this.zlevels = 1;
    this.zlevels_copy = 1;
    this.fold_level = 0;
    this.fold_level_copy = 0;
    this.fold_index = 0;
    this.fold_index_copy = 0;

    if (this.debug) {
        script_path = this.params.script;
        // console.debug ("script=" + script_path);
        if (script_path != null) {
            // TODO - Scripting
            // script = new Script (script_path);
        }
    }
    var model_path = this.params.model;
    console.debug ("model=" + model_path);
    if (model_path) {
        this.load_model (model_path);
    } else {
        console.debug ("using default model");
        this.default_model ();
    }

    this.enable_undo(false);
    this.mode = "fold";
    window.onresize ();
    this.refresh (null);
}

Cutfold.prototype.default_model = function () {
  // Initialize square piece of paper
  this.polys.push(Polygon.square50());
}

// recalculate some cached data structures when the geometry or topology changes
// also forces a repaint.
Cutfold.prototype.refresh = function (axis) {
    this.getModelBounds (true);
    // sort in descending z order so that polys will be drawn bottom up
    Polygon.sort (this.polys, false);
    if (axis != null) {
        this.make_tween_map (this.polys, true);
        this.tween_axis = axis;
        this.compute_axis_distances (axis);
        this.rotation_style = 1;
        this.rescale_canvas (this.canvas, 2000, true);
    } else {
        this.rescale_canvas (this.canvas, 100, true);
    }
    this.repaint ();
}

/*
 * rhsTest
 *  checks which side of (x1,y1)->(x2, y2) (x,y) is on; returns
 *  a boolean indicating whether it's on the rhs (or on the line itself).
 */
Cutfold.prototype.rhsTest = function (x1, y1, x2, y2, x, y) {
    var px = x - x1;
    var py = y - y1;
    var rx = x2 - x1;
    var ry = y2 - y1;
    return (px*ry - py*rx) <= 0;
}

Cutfold.prototype.globalToLocal = function (v) {
    // convert screen coordinates to paper coordinates
    v.x = (v.x - this.xoff) / this.scale;// used to round???
    v.y = (v.y - this.yoff) / this.scale;
}

Cutfold.prototype.localToGlobal = function (v) {
    // convert paper coordinates to screen coordinates
    v.x = (v.x * this.scale) + this.xoff;
    v.y = (v.y * this.scale) + this.yoff;
}

Cutfold.prototype.undo = function () {
    if (this.polys_undo_copy != null) {
        // restore previous data structures:
        // FIXME this is dumb we should just cache this entire object
        this.zlevels = this.zlevels_copy;
        this.fold_level = this.fold_level_copy;
        this.fold_index = this.fold_index_copy;
        this.polys = this.polys_undo_copy;

        this.enable_undo (false); // only one level of undo
        this.polys_undo_copy = null;
        this.refresh (null);
    }
}

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
 *   foldPoly will fold polygons using a left-hand rule.
 *   After being split, the halves to the left of the fold line are folded
 *   underneath (they are reflected about the fold line and have their z-value reflected
 *   around the (new) central z value.
 */


Cutfold.prototype.foldModel = function (x1, y1, x2, y2) {
    console.info ("foldModel");

    // convert the pair of coordinates to a vector (a pair of vertices)
    var v1 = new Vertex (x1, y1);
    var v2 = new Vertex (x2, y2);
    this.globalToLocal (v1);
    this.globalToLocal (v2);
    v1.next = v2;

    var pcopy = this.copyModel (); // copy all the entire model
    var new_polys = [];
    var i, npolys = this.polys.length;
    for (i = 0; i < npolys; i++) {
        // split all the polys intersected by the fold, modifying the existing polys
        // and creating new ones on the other side of the fold, storing those in new_polys
        this.polys[i].fold (v1, new_polys, this.fold_level + 1, this.fold_index + 1);
    }
    if (new_polys.length <= 0) {
        console.info ("foldModel aborting");
        return;
    }
    this.polys_undo_copy = pcopy;     // save copy for undo
    this.enable_undo (true);

    // ad the new polys created above to the model's poly list
    this.polys = this.polys.concat(new_polys);

    // save a copy before reflecting for use in animating the fold
    this.polys_tween_copy = this.copyModel ();
    Polygon.sort (this.polys_tween_copy, false);

    // traverse the polygon graph, propagating the flipme flag to
    // mark the dependent polygons to be folded.
    var p = new_polys[0];
    p.markPolyGraph (p.flipme, null, this.fold_index + 1);
    this.zlevels *= 2;
    this.reflectMarkedPolys (this.polys, v1, v2, this.zlevels);
    this.clearPolyFlags (this.polys);
    this.fold_level ++;
    this.fold_index ++;

    //this.print ();
    this.refresh (new Affine (v1, v2));
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

Cutfold.prototype.unfold_once = function () {
    console.debug ("unfold,level=" + this.fold_level);
    if (this.fold_level <= 0) {
        return;
    }

    this.polys_tween_copy = this.polys_undo_copy = this.copyModel (); // save for undo and tweening
    // console.debug ("copied polys");
    this.enable_undo (true);

    // this depends on operating in stacking order because of the way we
    // modify the structure as we go.  The "flipped" polygons will always
    // show up first (because we always fold down and unfold up).

    var zmid = (1 << this.fold_level) / 2;
    var j;
    for (j=0; j < this.polys.length; j++) {
        if (this.getPoly(j).z < zmid)
            break;
    }
    //System.out.println ("zmid=" + zmid + ",  j=" + j);
    var creases = [];
    creases.length = j;
    var axis = null;
    // print ();
    // flip all polys w/z >= (2 ^ fold_level) / 2
    for (var i=0; i<j; i++) {
        var p = this.polys[i];
        var v = p.points;
        var pv = v.findPrev ();
        var max_fold_level = -1;
        var innermost = null;
        do {
            if (v.fold != null && v.fold.level == this.fold_level) {
                // reflect the adjacent poly and any "descendants" on the same
                // side of the edge v.
                if (!p.flipped) {
                    var p1 = v.fold.twin.v.poly;
                    p.is_anchor = true;
                    p1.is_anchor = true;
                    p1.flipme = false;
                    p.markFoldedPolys (v.fold.index, null);
                    this.reflectMarkedPolys (this.polys, v, v.next, this.zlevels);
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
      // console.debug ("unfolding " + p.id);
      creases[i].fold.unfold ();
      }
      }
    */
    for (var i=0; i<j; i++) {
        // instead of erasing creases, just mark them so they can be displayed
        // differently
        if (creases[i] != null) {
            creases[i].fold.mark_creases ();
            creases[i].fold.twin.mark_creases ();
        }
    }
    this.cullEmptyPolys (this.polys);
    this.clearPolyFlags (this.polys);
    -- this.fold_level;
    this.zlevels /= 2;
    this.refresh (axis);
}

Cutfold.prototype.cullEmptyPolys = function (polys) {
    for (var i = 0; i < this.polys.length; i++) {
        if (this.polys[i].points == null) {
            this.polys.splice (i, 1); /* remove the poly */
            --i;
        }
    }
}

Cutfold.prototype.initCut = function (v) {
    var min_dist = 5;
    this.globalToLocal (v);
    // TBD figure out if what it says just below is really true and
    // maybe remove the following test:
/*
        for (int i=0; i<polys.length; i++) {
            // only allow cuts to start outside the paper.  This avoids
            // a buggy situation I think.  If you start and end inside the
            // poly and the edge connecting your first and last points
            // leaves (and re-enters) the polygon then cutModel is broken
            if (getPoly (i).encloses (v)) {
                return false;
            }
        }
*/
    this.pcut = new Polygon();
    var u = v.copy();
    this.pcut.points = u;
    this.localToGlobal (v);
    var g = this.getGraphics();
    var x = Math.round(v.x);
    var y = Math.round(v.y);
    g.rect (x-2, y-2, x+2, y+2);
    g.stroke();
    g.fill();
    return true;
}

Cutfold.prototype.cutSelect = function (v, close_pcut) {

    var min_dist = 5;
    // check for intersections w/pcut, and if there is one then form
    // a polygon and cut immediately.  We used to wait until the user
    // double-clicked, but this way we prevent people from making
    // self-intersecting polygons which cause all kinds of complication :)
    var u, ux = null, ex = null, start;
    u = this.pcut.points;
    while (u.next != null) {
        // advance u to the end of the linked list -
        // this will be the first point selected
        u = u.next;
        if (u == this.pcut.points) {
            // don't go infinite looping
            break;
        }
    }

    if (close_pcut) {
        // the user double-clicked, so pretend they clicked on exactly
        // the first point again and check for self-intersections

        // NB - in this case we may already have come through here once
        // before with the same v and close_pcut=false (for the first
        // click of the double click).

        if (u == this.pcut.points.next) {
            // don't allow cutting with a single line segment if either
            // endpoint lies inside any polygon:
            // it introduces degenerate cases I don't want to deal with
            if (this.findPolygon(u) != null || this.findPolygon (pcut.points) != null) {
                return false;
            }
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
        console.debug ("cutSelect return true");
        return true;
    }

    // end this cut if we are outside all polygons and we started
    // cutting outside all polygons
    //console.debug ("findPolygon (pcut.points)=" + findPolygon (pcut.points));
    //console.debug ("findPolygon (v)=" + findPolygon (v));
    if (this.findPolygon (u) == null && this.findPolygon (v) == null) {
        close_pcut = true;
        v.next = this.pcut.points;
        this.pcut.points = v;
        return true;
    }
    var tmax = 0, treturn = [];
    // makes an inf. loop if ! close_pcut
    v.next = this.pcut.points;
    for (u = this.pcut.points.next;
         u != null && u.next != null && u != this.pcut.points;
         u = u.next) {
        var uxx = v.intersectEdges (u, treturn);
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
    u.next = this.pcut.points;
    this.pcut.points = u;

    if (ux != null) {
        return true;        // go ahead and cut
    }
    var g = this.getGraphics();
    g.rect (v.x-2, v.y-2, v.x+2, v.y-2);
    console.debug  ("cutSelect return false");
    return false;           // continue selecting
}

Cutfold.prototype.cutModel = function () {
    var new_polys = [];
    var new_new_polys = [];
    var cut_folds = [];
    var i;

    this.polys_undo_copy = this.copyModel (); // save for undo
    this.enable_undo (true);

    console.debug ("cutModel");

    var npolys = this.polys.length;
    this.pcut.computeBoundingBox ();
    for (i = 0; i < npolys; i++) {
        var p = this.polys[i];
        if (! this.pcut.overlaps (p)) {
            // perform simple bounding box test to exclude some
            // polygons from the more expensive computations
            console.debug ("pcut does not overlap poly " + p.id);
            continue;
        }
        console.debug ("cutting poly " + p.id);
        p.cut (this.pcut, new_new_polys, cut_folds);
        p.computeBoundingBox ();
        // don't try to cut the new_polys
        new_polys = new_polys.concat (new_new_polys);
        new_new_polys = [];
    }
    for (i = 0; i < new_polys.length; i++) {
        new_polys[i].computeBoundingBox ();
    }
    this.polys = this.polys.concat (new_polys);
    while (cut_folds.length > 0) {
        // TODO: no need for this surgery, just clear at the end?
        var f = cut_folds.shift ();
        f.patchCut ();
    }
    this.refresh (null);
    return true;
}

Cutfold.prototype.copyModel = function () {
    var polys_copy = []; polys_copy.length = this.polys.length;
    var polymap = []; polymap.length = Polygon.next_id;
    for (var i =0; i < this.polys.length; i++) {
        var p = new Polygon (this.polys[i]);
        polys_copy[i] = p;
        polymap [p.id] = i;
    }
    // match up folds:
    for (var i = 0; i < this.polys.length; i++) {
        var p = polys_copy[i];
        var q = this.polys[i];
        var u = p.points;
        var v = q.points;
        // System.out.println ("copying poly " + i);
        do {
            if (v.fold != null) {
                if (u.fold == null) {
                    u.fold = new Fold (u, v.fold.level, v.fold.index);
                }
                var j = polymap[v.fold.twin.v.poly.id];
                if (j < i) {
                    // u.fold's twin has already been created; find it
                    var p1 = polys_copy[j];
                    var q1 = this.polys[j];
                    var u1 = p1.points;
                    var v1 = q1.points;
                    do {
                        v1 = v1.next;
                        u1 = u1.next;
                    } while (v1 != v.fold.twin.v && v1 != q1.points);
                    // and link to it
                    if (v1 != v.fold.twin.v) {
                        console.debug ("copyModel couldn't link up fold?");
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
    this.zlevels_copy = this.zlevels;
    this.fold_level_copy = this.fold_level;
    this.fold_index_copy = this.fold_index;
    return polys_copy;
}

/*
 * polygon selection
 */

Cutfold.prototype.findPolygon = function (v) {
    // v in model coordinates
    for (var i = this.polys.length - 1; i >= 0; i--) {
        var p = this.polys[i];
        if (p.contains(v)) {
            return p;
        }
    }
    return null;
}

Cutfold.prototype.discardPolygon = function (v) {
    var p;
    var found = false;
    console.debug ("discard " + v.string());
    var pcopy = this.copyModel (); // save for undo
    while ((p = this.findPolygon (v)) != null)
    {
        console.debug ("discard found poly " + p.id);
        p.markPolyGraph (true, null, -1); // set the flipme flag
        for (var i = 0; i < this.polys.length; i++)
        {
            var q = this.polys[i];
            if (q.flipme) {
                // System.out.println ("discard removing poly " + q.id);
                this.polys.splice (i, 1);
                --i;
                found = true;
            }
        }
    }
    if (found) {
        this.polys_undo_copy = pcopy;
        this.enable_undo (true);
    }
    this.refresh (null);
    return found;
}

/************************************************************************
 * polygon manipulation: cutting and folding
 ************************************************************************/

Cutfold.prototype.reflectMarkedPolys = function (polys, v1, v2, zlevels) {
    var npolys = this.polys.length;
	
    // fold all the marked polygons now.  These will be the ones on the flipme
    // side of the fold or connected via earlier folds to one on the flipme.
    for (var i = 0; i<npolys; i++) {
        var p = this.polys[i];
        if (p.flipme && !p.flipped) {
            p.reflect (v1, v2, zlevels);
            p.flipped = true;
        }
    }
}

Cutfold.prototype.clearPolyFlags = function (polys) {
    for (var i = 0; i<polys.length; i++) {
        var p = this.getPoly(i);
        p.clearFlags ();
    }
}

/*
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
*/

Cutfold.prototype.make_tween_map = function (tween_polys, is_dest) {
    for (var i = 0; i < this.polys.length; i++) {
        this.tween_map[tween_polys[i].id] = i;
    }
    this.tween_map_has_dest = is_dest;
}

Cutfold.prototype.tweenModel = function (g) {
    var t = new Date().getTime();
    var ratio = 1.0;
    /*
    console.debug ("tweenModel, scale_time=" + this.scale_time +
                   ", scale_start=" + this.scale_start +
                   ", scale_target=" + this.scale_target);
    */
    if (t < this.scale_timer + this.scale_time) {
        ratio = (t - this.scale_timer) / this.scale_time;
        var r2 = Math.sqrt (ratio);
        this.xoff = Math.round (this.xoff_start + (this.xoff_target - this.xoff_start) * r2);
        this.yoff = Math.round (this.yoff_start + (this.yoff_target - this.yoff_start) * r2);
        this.scale = (this.scale_start + (this.scale_target - this.scale_start) * r2);
    } else {
        // done
        this.xoff = this.xoff_target;
        this.yoff = this.yoff_target;
        this.scale = this.scale_target;
        this.scale_timer = 0;
        this.polys_tween_copy = null;
        this.tween_axis = null;
        this.rotation_style = 0;
    }

    if (this.polys_tween_copy) {
        // In the first half of the tween, use the "before" stacking order
        // (tween_map is used to map to the "destination" polys)
        // and in the second half, update the tween_map so we can use the
        // "destination" stacking order
        if (this.tween_map_has_dest && ratio > 0.5) {
            this.make_tween_map (this.polys_tween_copy, false);
        }
        this.tweenModelPair (g, this.polys_tween_copy, this.polys, ratio);
    } else {
        this.drawModel (g);
    }

    // call this function again in a little while:
    if (this.scale_timer > 0) {
        var t = this;
        // TODO -- use canvas timing (requestAnimationFrame)
        // setTimeout(function () { t.repaint() }, 15);
        requestAnimationFrame (function () { t.repaint() });
    }
}

Cutfold.prototype.tweenModelPair = function (g, from_polys, to_polys, t) {
    for (var i = 0; i<from_polys.length; i++) {
        var pfrom, pto;
        if (t < 0.5) {
            // draw back to front using the from-ordering
            pfrom = from_polys[i];
            pto = to_polys[this.tween_map[pfrom.id]];
        } else {
            // draw back to front using the to-ordering
            pto = to_polys[i]
            pfrom = from_polys[this.tween_map[pto.id]];
        }
        if (pto.id != pfrom.id) {
            console.error ("tweenModelPair: Polygon mismatch");
        }
        pfrom.tween(pto, g, this.xoff, this.yoff, this.scale, t, this.rotation_style);
    }
}

Cutfold.prototype.spin = function () {
    this.polys_tween_copy = this.copyModel ();
    var v = new Vertex ((this.left+this.right)/2, this.top);
    var v1 = new Vertex ((this.left+this.right)/2, this.bottom);
    for (var i = 0; i<this.polys.length; i++) {
        this.polys[i].reflect (v, v1, this.zlevels);
    }
    this.refresh (new Affine (v, v1));
    this.rotation_style = 2;
}

Cutfold.prototype.compute_axis_distances = function (axis) {
    // used for perspective calculation when rotating
    console.debug ("cutfold.compute_axis_distances");
    for (var i = 0; i<this.polys.length; i++) {
        this.polys[i].compute_axis_distances(axis);
    }
}

Cutfold.prototype.drawModel = function (g) {
    // console.debug ("drawModel scale=" + this.scale);
    g.strokeStyle = "blue";
    for (var i = 0; i < this.polys.length; i++) {
        // console.debug ("draw poly "+ i + ", scale=" + this.scale);
        this.polys[i].draw(g, this.xoff, this.yoff, this.scale, this.tracing);
    }
}

Cutfold.prototype.getModelBounds = function (descend) {
    this.left  = 1000;
    this.right =-1000;
    this.top   = 1000;
    this.bottom=-1000;
    for (var i =0; i<this.polys.length; i++) {
        var p = this.polys[i];
        if (descend) {
            p.computeBoundingBox ();
        }
        if (p.left < this.left) this.left = p.left;
        if (p.right > this.right) this.right = p.right;
        if (p.top < this.top) this.top = p.top;
        if (p.bottom > this.bottom) this.bottom = p.bottom;
    }
    console.debug ("getModelBounds " + this.top + "," + this.left + ":" + this.bottom + "," + this.right);
}

Cutfold.prototype.print = function () {
    for (var i =0; i<this.polys.length; i++) {
        console.info (this.getPoly(i).xml());
    }
}

Cutfold.prototype.checkModel = function (polys)
{
    // console.debug ("ENTER checkModel");
    for (var i = 0; i<polys.length; i++) {
        var pcount = 0;
        var p = this.polys[i];
        var u = p.points;
        // console.debug ("checkModel " + i);
        // console.debug (p.string());
        do {
            if (u.fold != null) {
                if (u.fold.v != u) {
                    console.debug ("u.fold.v1 != u");
                }
                if (u.fold.twin.twin != u.fold) {
                    console.debug ("u.fold.twin.twin != u.fold");
                }
                if (u.fold.twin.v.poly.points == null) {
                    console.debug ("u.fold.twin.v.poly.points (p.id=" + u.fold.twin.v.poly.id + ") is null");
                }
                if (! u.fold.twin.v.near (u.next)) {
                    console.debug ("  ERROR fold.twin mismatch  ");
                    this.drawDiamond (u, Color.blue);
                    this.drawDiamond (u.next, Color.black);
                    this.drawDiamond (u.fold.twin.v, Color.red);
                    this.drawDiamond (u.fold.twin.v.next, Color.green);
                }
                if (u.fold.twin == u.fold ||u.fold.twin.v.poly == u.poly)
                {
                    console.debug ("   ERROR fold is its own twin?");
                    //drawDiamond (u.fold.v1, cursor, 0x0000ff);
                    // drawDiamond (u.fold.v2, cursor, 0x0000ff);
                }
                var v = u.fold.twin.v; // make sure v isn't orphaned
                var vv = v.poly.points;
                var count = 0;
                do {
                    vv = vv.next;
                    if (++count > 500) {
                        console.debug ("checkModel inner loop: WARNING: poly has > 100 points? possible inf. loop detected");
                        break;
                    }
                }
                while (vv != v && vv != p.points);
                if (vv != v) {
                    console.debug ("  ERROR vertex has orphaned twin");
                    this.drawDiamond (u, Color.blue);
                    this.drawDiamond (u.fold.twin.v, Color.red);
                }
            }
            if (u.poly.id != p.id) {
                console.debug ("  ERROR point poly id mismatch");
            }
            u = u.next;
            if (++pcount > 500) {
                console.debug ("checkModel inner loop: WARNING: poly has > 100 points? possible inf. loop detected");
                break;
            }
        } while (u != p.points);
    }
    console.debug ("checkModel found " + polys.length + " polygons");
}

Cutfold.prototype.getGraphics = function () {
    return this.canvas.getContext("2d");
}

Cutfold.prototype.drawDiamond = function (v, c)
{
    var g = this.getGraphics ();
    g.setColor (c);
    var x = Math.round(v.x * this.scale) + this.xoff;
    var y = Math.round(v.y * this.scale) + this.yoff;
    console.debug ("diamond " + x + ", " + y);
    g.rect (x-2, y-2, x+2, y+2);
}

Cutfold.prototype.enable_undo = function (b) {
    this.panel.enable_undo (b);
}

Cutfold.prototype.getPoly = function (i) {
    return this.polys[i];
}

function htmlEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

Cutfold.prototype.postURL = function ()  {
    var caption = document.getElementById("caption");
    if (! caption) {
        console.error ("missing caption element");
        return;
    }
    if (!caption.value) {
        this.panel.setHelpText ("Please enter a title for your flake.");
        return;
    }
    var xml = "<cutfold.model>";
    for (var i =0; i < this.polys.length; i++) {
        xml += this.getPoly(i).xml() + "\n";
    }
    // TBD - should HTML encode the caption...
    xml += "<caption>" + htmlEscape(caption.value) + "</caption>\n";
    xml += "</cutfold.model>";
    var myurl = location.href;
    var url = myurl.substring (0, myurl.lastIndexOf('/')+1);
    url = url + "save.cgi"
    invoke_request ("POST", url, Cutfold.postCallback, xml);
}

Cutfold.postCallback = function () {
    location.href += "gallery/";
}

// TODO: read model from URL
Cutfold.prototype.load_model = function (model_path) {
    get_request (model_path, Cutfold.onLoadModel, this);
}

Cutfold.onLoadModel = function (xmlhttp, cutfold) {
    var xml = xmlhttp.responseXML;
    var vertex_map = {};
    var fold_level = 0, fold_index = 0;
    var polyNodes = xml.getElementsByTagName ("polygon");
    // console.debug ("got " + polyNodes.length + " polygons");
    for (var i = 0; i < polyNodes.length; i++) {
        var pnode = polyNodes.item(i);
        // console.debug ("poly " + i + ": " + pnode + " " + pnode.getAttribute("id"));
        var p = new Polygon ();
        p.id = parseInt(pnode.getAttribute("id"));
        p.z = parseInt(pnode.getAttribute("z"));
        p.faceup = (pnode.getAttribute("faceup") == "true");
        var nodes = pnode.childNodes;
        var lastv = null;
        for (var j = 0; j < nodes.length; j++) {
            var node = nodes.item (j);
            if (node.nodeName == "vertex") {
                var v = new Vertex (parseFloat(node.getAttribute("x")),
                                    parseFloat(node.getAttribute("y") + 0));
                v.is_crease = node.getAttribute("is_crease") == "true";
                v.id = parseInt(node.getAttribute("id"));
                v.poly = p;
                if (! lastv) {
                    p.points = v;
                } else {
                    lastv.next = v;
                }
                lastv = v;
                vertex_map[v.id] = v;
                var vnodes = node.childNodes;
                for (var k = 0; k < vnodes.length; k++) {
                    var vnode = vnodes.item(k);
                    if (vnode.nodeName == "fold") {
                        var f = new Fold (v, parseInt(vnode.getAttribute("level")), parseInt(vnode.getAttribute("index")));
                        v.fold = f;
                        var twin  = parseInt(vnode.getAttribute("twin"));
                        var u = vertex_map[twin];
                        if (u) {
                            // console.debug ("twins: " + v.id + "," + twin);
                            f.twin = u.fold;
                            u.fold.twin = f;
                        } else {
                            // console.debug ("no twin for " + v.id);
                        }
                        if (f.level > fold_level) {
                            fold_level = f.level;
                        }
                        if (f.index > fold_index) {
                            fold_index = f.index;
                        }
                    }
                }
            }
        }
        lastv.next = p.points; // close the loop
        cutfold.polys.push (p);
        //console.debug (p.string());
    }
    // renumber polygons - make sure next_id doesn't overlap an existing
    // polygon!
    for (var i =0; i < cutfold.polys.length; i++) {
        cutfold.getPoly(i).id = i;
    }
    console.debug ("loaded " + cutfold.polys.length + " polys");
    Polygon.next_id = cutfold.polys.length;
    cutfold.zlevels = 1 << fold_level;

    cutfold.checkModel (cutfold.polys);
    cutfold.scale = 1.0;
    cutfold.refresh(null);
}

/**
* Provides requestAnimationFrame in a cross browser way.
* @author paulirish / http://paulirish.com/
*/

if ( !window.requestAnimationFrame ) {
    window.requestAnimationFrame = ( function() {

        return window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element ) {
                window.setTimeout( callback, 1000 / 60 );
            };
    } )();
}
