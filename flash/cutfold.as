/************************************************************************
 *  Main entry points.
 *  These are functions that are called directly from event handlers.
 ************************************************************************/

/* TODO:
 * cut using a polygonal path, not just a single line segment
 * truly cut - remove one polygon after cutting.  Add action buttons for
 *  cut, burn, fold, unfold and cancel.
 *   UI sequences: 
 *    cut: (1) press cut button.  (2) draw path. (3) press ok or cancel. 
 *      (polygons severed)
 *    burn: (1) press burn button. (2) click on a polygon.  (polygon burnt).
 *    fold: (1) press crease button. (2) draw single line segment. 
 *    (3) select fold up or down and then a polygon or cancel.
 *    unfold: (1) press unfold button - (snowflake is revealed).  
 *    Or - unfold one step at a time?
 * nice touches: iconic buttons and cursor states.  
 *   fold/unfold animation.  patterned paper?
 * 
 */
 
/*
 * for a production version: remove debugging code (incl. poly id, fold.poly); 
 * merge
 * flags into bitfield.  maybe could optimize the marking algorithm to only
 * mark polys that do need to be flipped?
 */
 
/* 	init()
 * Called when the script starts.  Creates the paper movieclip that
 * contains all the polygon data structures.  The canvas movieclip exists
 * only to enforce the proper stacking order (so the cursor will be on top
 * of the paper).  
 */
 
function init()
{
    // data structure initialization
    canvas.polys = [];
    canvas.zlevels = 1;
    canvas.fold_level = 0;
    canvas.next_poly_id = 0;
    error = false;
    with (canvas) {
	var last = new Point(100, 20);
	var v = new Point(100, 380, last);
	v = new Point(460, 380, v);
	v = new Point(460, 20, v);
	var square = new Poly();
	square.points = v;
	last.next = v;
	polys.push(square);
        getModelBounds (polys, true);
	drawModel (canvas);
    }
    colors = new Array (0x444433, 0x554433, 0x663344, 0x446633, 0x333366,
                        0x666666, 0x884488, 0x992222, 0x229922, 0x222299);
}

function setCursor (clip)
// set (or clear) a custom cursor
{
    if (cursor.cursorclip) 
        cursor.cursorclip._visible = false;
    if (clip) {
        Mouse.hide ();
        cursor.cursorclip = clip;
        clip._x = _root._xmouse;
        clip._y = _root._ymouse;
        clip._visible = true;
    } else {
        Mouse.show ();
    }
}

function printModel ()
{
    print ("canvas", "bframe");
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
 *   foldPoly will fold polygons using a right-hand rule.
 *   After being split, the halves to the right of the fold line are folded
 *   underneath (they are reflected about the fold line and have their z-value reflected
 *   around the (new) central z value.
 */


function foldModel (x1, y1, x2, y2)
{
    /*
    var v1 = { x: x1-1.5, y : y1-2.5 } ;
    var v2 = { x: x2-1.5, y : y2-2.5 } ;
    */
    var v1 = { x: x1, y : y1 } ;
    var v2 = { x: x2, y : y2 } ;
    canvas.globalToLocal (v1);
    canvas.globalToLocal (v2);
    v1 = new Point (v1.x, v1.y);
    v2 = new Point (v2.x, v2.y);
    // trace ("fold " + x1 +"," + y1 + "->"+x2+","+y2);

    var new_polys = [];
    var npolys = canvas.polys.length;
    var i;
    // trace ("foldModel: " + npolys );
    // dumpPolys (canvas.polys);
    for (i = 0; i < npolys; i++) {
        // trace ("splitPoly " +canvas.polys[i].id);
        foldPoly (canvas.polys[i], v1, v2, new_polys, canvas.fold_level + 1);
        /*
        dumpPolys (canvas.polys);
        trace ("new polys:");
        dumpPolys (new_polys);
        */
    }
    if (new_polys.length <= 0)
        return;
    for (i = 0; i<new_polys.length; i++) {
        canvas.polys.push (new_polys[i]);
    }

    // traverse the polygon graph, propagating the flipme flag to mark the dependent
    // polygons to be folded.
    markPolyTree (new_polys[0], new_polys[0].flipping, null, canvas.fold_level + 1);
    canvas.zlevels *= 2;
    reflectMarkedPolys (canvas.polys, v1, v2, canvas.zlevels);
    clearPolyFlags (canvas.polys);
    canvas.fold_level ++;
    // dumpPolys (canvas.polys);

    getModelBounds (canvas.polys, true);
    // checkModel (canvas.polys);
    drawModel (canvas);
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
 
function unfold_once ()
{
    if (canvas.fold_level <= 0) 
        return;
    // trace ("UNFOLD");

    // this depends on operating in stacking order because of the way we
    // modify the structure as we go.  The "flipped" polygons will always
    // show up first (because we always fold down and unfold up).

    var j;
    for (j=0; j<canvas.polys.length; j++)
    {
        if (canvas.polys[j].z < canvas.fold_level / 2)
            break;
    }
    // flip all polys w/z >= canvas.fold_level / 2.
    for (var i=0; i<j; i++) 
    {
        var p = canvas.polys[i];
        var v = p.points;
        do {
            if (v.fold && v.fold.level == canvas.fold_level)
            {
               // reflect the adjacent poly and any "descendants" on the same
               // side of the edge v.
                if (!p.flipped)
                {
                    var p1 = v.fold.twin.v1.poly;
                    p.is_anchor = true;
                    p1.is_anchor = true;
                    p1.flipme = false;
                    // trace ("unfolding " + p.id);

                    markPolySubTree (p, v.fold.level);
                    reflectMarkedPolys 
                        (canvas.polys, v.fold.v1, v.fold.v2, canvas.zlevels);
                }
                // merge this polygon with the one one the other side of the
                // fold (now just a crease).
                removeFold (v.fold);
                // go on to the next poly - this poly no longer exists.
                // If it had multiple folds at this level, the others will be
                // removed when we process its twins
                break;
            }
            v = v.next;
        } while (v != p.points);
    }
    cullEmptyPolys (canvas.polys);
    clearPolyFlags (canvas.polys);
    // checkModel (canvas.polys);
    -- canvas.fold_level;
    canvas.zlevels /= 2;
    getModelBounds (canvas.polys, true);
    drawModel (canvas);
}

function removeFold (f)
{
    /* cut out e, e1 and their folds, and eliminate f.v1.poly */
    var e = f.v1;
    var p = e.poly;
    var e1 = f.twin.v1;
    var p1 = e1.poly;
    // trace ("removeFold " + p.id + " merging with " + p1.id);
    var ep = findPrev (e);
    var e1p = findPrev (e1);
    ep.next = e1.next;
    e1p.next = e.next;
    p1.points = e1p;
    if (ep.fold)                /* fix up neighboring folds */
        ep.fold.v2 = ep.next;
    if (e1p.fold)
        e1p.fold.v2 = e1p.next;
    setPointsPoly (p1);          /* get rid of p by unlinking */
    p.points = null;           /* and marking for later removal */
    
    // trace ("removeFold removing extra folds ");
    e = e1p; do {
        e1 = e.fold.twin.v1;
        if (e.fold && (e1.poly == p || e1.poly == p1)) 
        {
            // it must be the another segment of the fold we are removing
            // if it connects p and p1, so delete the folds associated 
            // with these edges, which are now just a (pair of) internal edges;
            // a slice connecting an interior hole with the exterior, 

            // or in the degenerate case (no hole), remove the edges.
            // TBD: handle cases where the degenerate crease has more than
            // one pair of edges
            if (e.next == e1) {
                e.next = e1.next.next;
                e.fold = null;
            } else if (e1.next == e) {
                e1.next = e.next.next;
                e1.fold = null;
            } else {
                // TBD:  make these edges invisible
                e.fold = null;
                e.is_crease = true;
                e1.fold = null;
                e1.is_crease = true;
            }
        }
        e = e.next;
    } while (e != e1p);
    // trace ("removeFold done ");
}

function cullEmptyPolys (polys)
{
    for (var i = 0; i < polys.length; i++) {
        if (! polys[i].points) {
            polys.splice (i, 1); /* remove the poly */
            --i;
        }
    }
}

function cutSelect (x1, y1, x2, y2)
{
    // trace ("cutSelect " + x1 + "," + y1 + "  " + x2 + "," + y2);
    var v1 = { x: x1, y : y1 } ;
    var v2 = { x: x2, y : y2 } ;
    canvas.globalToLocal (v1);
    canvas.globalToLocal (v2);
    v1 = new Point (v1.x, v1.y);
    v2 = new Point (v2.x, v2.y);

    // trace ("line:  " + v1.x + "," + v1.y + " =>  " + v2.x + "," + v2.y);
    canvas.moveTo (v1.x, v1.y);
    canvas.lineStyle(0, 0x000000, 100);
    canvas.lineTo (v2.x, v2.y);
    updateAfterEvent ();

    var u = null;
    var v;
    var treturn = {};
    // maybe get all the intersections and just use the closest one?
    for (v = pcut.points; v; v = v.next && !u) {
        u = intersectEdges (v1, v2, v, v.next, true, treturn);
        if (treturn.t <= 0) {
            u = null;
        }
    } 
    
    // create pcut if it doesn't exist yet
    if (!pcut) {
        pcut = new Poly();
        pcut.points = v1;
    }

    var v = pcut.points;
    while (v.next) {  /* find the end of the poly's linked list */
        v = v.next;
    }
    if (!u) {
        // append v2 to pcut
        v.next = v2;
        return false;
    }
    
    // cut as soon as we have a closed poly
    v.next = u;                 /* append u to p */

    // u.next = pcut.points;    /* close the poly*/
    // ???
    u.next = pcut.points.next // eliminate pcut.points to ensure a closed polygon
    pcut.points = u;
    cursor.clear ();
    drawPoly (pcut, canvas);
    cutModel ();
    return true;
}

function cutModel () 
{
    // do cutting
    var npolys = canvas.polys.length;
    var new_polys = [];
    var cut_folds = [];
    var i;
    var new_new_polys = [];
    // dumpPolyBrief (pcut);
    computeBoundingBox (pcut);
    for (i = 0; i < npolys; i++) {
        if (! polysOverlap (canvas.polys[i], pcut)) {
            // a bounding box test
            continue;
        }
        cutPoly (canvas.polys[i], pcut, new_new_polys, cut_folds);
        computeBoundingBox (canvas.polys[i]);
        while (new_new_polys.length) {
            // don't try to cut the new_polys
            new_polys.push (new_new_polys.pop());
        }
    }
    for (i = 0; i < new_polys.length; i++) {
        canvas.polys.push(new_polys[i]);
        computeBoundingBox (new_polys[i]);
    }
    for (i = 0; i < cut_folds.length; i++) {
        patchCutFold (cut_folds[i]);
    }

    getModelBounds (canvas.polys, false);
    drawModel (canvas);
    // dumpPolys (canvas.polys)
    // checkModel (canvas.polys);
    // clear pcut
    pcut = null;
}

/*************************************************************************
 * drawing functions 
 *************************************************************************/

function drawModel(mc)
{
    mc.clear ();
    mc.lineStyle(0, 0x000000, 100);
    // sort in inverse stacking order - draw bottom poly first
    mc.polys.sort(polyStackComparison);
    for (var i = 0; i<mc.polys.length; i++) {
        drawPoly (mc.polys[i], mc);
    }
}

function rescale_canvas ()
{
    // center and scale to fit, assuming screen size 560 x 400 
    var xspan = (canvas.bounds.right - canvas.bounds.left);
    var yspan = (canvas.bounds.bottom - canvas.bounds.top);
    var scale = 100 * (xspan > yspan ? (360 / xspan) : (360 / yspan));
    var newx = 280 - (canvas.bounds.right + canvas.bounds.left) * scale / 200;
    var newy = 200 - (canvas.bounds.bottom + canvas.bounds.top) * scale / 200;
    canvas.scale_delta = (scale-canvas._xscale) / 6;
    canvas.x_delta = (newx-canvas._x) / 6;
    canvas.y_delta = (newy-canvas._y) / 6;
    canvas.rescale_idx = 6;
}

function drawPoly(p, mc) 
{
    var v = p.points;
    if (! v)
        return;
    var scale = 100 / canvas._xscale;
    mc.moveTo(v.x, v.y);
    mc.beginFill(p.faceup ? p.fgcolor : 0xaaaaaa, 70);
    mc.lineStyle(0, 0, 100);
    do {
        if (v.fold)
            canvas.lineStyle(v.fold.level * scale, 0, 100);
        else if (v.is_crease) {
            canvas.lineStyle(0, 0, 0);
        } else {
            canvas.lineStyle(0, 0, 100);
        }
        v = v.next;
        mc.LineTo(v.x, v.y);
    } while (v != p.points);
    mc.endFill();
}

function drawDiamond (v, mc, c)
{
    mc.lineStyle(0, 0x000000, 100);
    mc.beginFill(c, 100);
    mc.moveTo(v.x-3, v.y);
    mc.LineTo(v.x, v.y-3);
    mc.LineTo(v.x+3, v.y);
    mc.LineTo(v.x, v.y+3);
    mc.LineTo(v.x-3, v.y);
    mc.endFill();
}

/*
 * polygon selection
 */

function findPolygon (x, y)
{
    var v = { x: x, y : y } ;
    canvas.globalToLocal (v);
    v = new Point (v.x, v.y);
    canvas.selectedPoly = null;
    for (var i = canvas.polys.length - 1; i >= 0; i--)
    {
        if (containsPoly(canvas.polys[i], v))
        {
            return canvas.polys[i];
        }
    }
}

function discardPolygon (x, y)
{
    var p;
    var found = false;
    while (p = findPolygon (x, y))
    {
        markPolyTree (p, true, null, 0);
        for (var i = 0; i < canvas.polys.length; i++)
        {
            if (canvas.polys[i].flipme) {
                var p = canvas.polys[i];
                canvas.polys.splice (i, 1); /* remove the poly */
                deletePoly (p);
                --i;
                found = true;
            }
        }
    }
    getModelBounds (canvas.polys, false);
    drawModel (canvas);
    return found;
}

function test (x, y) {
    var v = new Point (x, y);
    if (containsPoly (canvas.polys[0], v)) {
        trace ("in");
    } else {
        trace ("out");
    }
}

/************************************************************************
 * polygon manipulation: cutting and folding
 ************************************************************************/
 
/*
 * foldPoly splits a polygon in two with a line segment, modifying the
 * argument p and returning a list of any new polygons that are created.
 */

function foldPoly (p, v1, v2, new_polys, fold_level)
{
    var intersections = intersectPoly (p, v1, v2);
    if (intersections.length < 2) {
        return null;	// Ignore snips into the interior that leave the polygon whole
    }
    var inp = contains(p, v1);
    if (inp && intersections.length < 3) {
        return null;	// Ignore snips from the interior to the interior that leave the polygon whole
    }
    if (inp) {
        // ignore the first intersection since it's just incidental if we started inside the polygon
        intersections.shift(); // TBD delete me?
    }
    while (intersections.length > 1) {	 
        /* Create a new poly from one side of the cut (or fold) In the new
        poly, the dividing edge contains the points b, a in the sequence:
        b0->b->a->a.next.  Also modify the existing poly to contain the new
        edge in the sequence: a0->a->b->b0.next */
        var a_int = intersections.shift();
        var a = a_int.pt, a0 = a_int.edge;
        var fa = a0.fold;
		 
        var b_int = intersections.shift();
        var b = b_int.pt, b0 = b_int.edge;
        var fb = b0.fold;
		 
        // trace ("foldPoly a=(" + a.x + "," + a.y + "), b=(" + b.x + "," + b.y + ")");
        var p1 = copyPoly (p);

        // clone b and a for the new poly and set up the fold structure linking them
        // and their polygons together
        var b1 = copyPoint (b);
        var a1 = copyPoint (a);
        var f = new Fold (p, a, b, fold_level);
        a.fold = f; 
        // b.fold = f;
        var f1 = new Fold (p1, b1, a1, fold_level);
        b1.fold = f1; 
        // a1.fold = f1;
        f1.twin = f;
        f.twin = f1;

        // relink the points to form p1
        b1.next = a1;
        a1.next = a0.next;
        b.next = b0.next; // part of p, not p1 - but do it now to avoid losing the link
        b0.next = b1;
        p1.points = b1;
        new_polys.push (p1);
		 
        // hook up the p points
        a0.next = a;
        a.next = b;
        p.points = a;  // may be redundant, but sometimes needed...
		 
        // set the poly links of all the points in p and p1
        setPointsPoly (p);
        setPointsPoly (p1);
		 
        // mark these polys as having determinate flippedness
        p1.is_anchor = true;
        p.is_anchor = true; 
			 
        // determine which poly is on the right hand side of the fold and mark it.
        if (p.faceup) {
            p.flipme = true;
        } else {
            p1.flipme = true;
        }
        // I checked via dumpPolys and everything looked good after two folds
        // - once widthwise and once lengthwise
         if (fa) {
            if (fa.v1 != a0 || fa.v2 != a1.next) {
                trace ("BARF FA");
            }
            foldFold (fa, a, a1); // split the fa fold in two
        }
        if (fb) {
            if (fb.v1 != b0 || fb.v2 != b.next) {
                trace ("BARF FB");
            }
            foldFold (fb, b1, b); // split the fb fold in two
        }
        // dumpPoly (p);
        // dumpPoly (p1);
        delete a_int;  // unnecessary?
        delete b_int;
    }
}
 
function foldFold (f, a, a1)
{
    // split the f fold in two
    var f1 = new Fold (a1.poly, a1, f.v2, f.level);
    f.v2 = a; 
    // a.fold = f;  // no - should be set to the new higher-level fold 
    a1.fold = f1;
    if (f1.v2.fold == f)        /* f.v2.fold is already = f if it should */
        f1.v2.fold = f1;
    if (f.other_twin) {
        // fa's twin has already been split - it left a ptr in f
        f1.twin = f.twin;
        f.twin = f.other_twin;
        // f.twin.twin = f; -- already?
        f1.twin.twin = f1;
        delete f.other_twin;
    } else {
        f1.twin = f.twin; /* for now */
        f.twin.other_twin = f1;
    }
}

/* markPolySubTree */
function markPolySubTree (p, fold_level, parent)
{
    if (p.visited) {
        // trace ( " markPoly " + p.id + " (already)");
        return;   // stop this thing from going on forever
    }
    p.visited = true;
    p.flipme = true;
    // trace ( " markPoly marking " + p.id);
    var v = p.points;
    do {
        var f = v.fold; var p1;
        if (f && (p1 = f.twin.v1.poly) != parent)
        {
            if (f.level != fold_level) {
                // don't cross the fold 
                markPolySubTree (p1, fold_level, p);
            }
        }
        v = v.next;
    } while (v != p.points);
}

/* markPolyTree
  * Walk a graph of polys, following fold_poly links, setting flags 
  */
  
function markPolyTree (p, flipping, parent, fold_level)
{
    if (p.visited) {
        // trace ( " markPoly " + p.id + " (already)");
        return;   // stop this thing from going on forever
    }
    p.visited = true;
    if (p.is_anchor) {
        // The newly split polygons are like islands of certainty in a sea of doubt...
        flipping = p.flipme;
        // trace (" markPoly " + p.id + " new - set flipping to " + flipping);
    } else {
        p.flipme = flipping;
        // trace (" markPoly " + p.id + " flipme set to " + flipping);
    }
    var v = p.points;
    do {
        // recurse through folds, including the current one.
        // the parent test is not strictly necessary - it just saves some useless recursions
        var f = v.fold; var p1;
        if (f && (p1 = f.twin.v1.poly) != parent)
        {
            if (f.level == fold_level) {
                // change flipping when crossing the fold 
                markPolyTree (p1, !flipping, p, fold_level);
            } else {
                markPolyTree (p1, flipping, p, fold_level);
            }
        }
        v = v.next;
    } while (v != p.points);
}

function cutPoly (p, pcut, new_polys, cut_folds)
{
    var v = pcut.points;
    var vout = new Point (-100, -100);
    // trace ("cutPoly " + p.id);
    // see if v is inside p (and remember a "nearby" intersection)
    var inside;
    var outer_xings;
    do {
        outer_xings = intersectPoly (p, vout, v);
        inside = outer_xings.length % 2 == 1;
        if (! inside) 
            break;
        v = v.next;
    } while (v != pcut.points);
    if (inside) {
        // there are no external points...
        // maybe figure this out later
        // trace ("  inside poly " + p.id + "; skipping");
        return;
    }
    /*
    if (v != pcut.points) {
        pcut.points.poly = pcut;
        var prev = findPrev (pcut.points);
        prev.next = pcut.points.next; // eliminate the extra tail on the poly
        pcut.points = v;        // start at an outside point
    }
    */
    pcut.points = v;        /* start at an outside point */

    var nxings = 0;
    var xings = [];
    var pp = null;
    do {
        var vxings, min_dist = 2;
        if (pp) {
            vxings = intersectPoly (pp, v, v.next);
        } else {
            // search for the first poly of our new batch to be intersected by this
            // line segment
            vxings = intersectPoly (p, v, v.next);
            if (vxings.length > 0) {
                min_dist = vxings[0].t;
                pp = p;
            }
            for (var i = 0; i < new_polys.length; i++) {
                var pivxings = intersectPoly (new_polys[i], v, v.next);
                if (pivxings.length > 0 && min_dist > pivxings[0].t) {
                    min_dist = pivxings[0].t;
                    vxings = pivxings;
                    pp = new_polys[i];
                    // TBD - check to be sure we can break here - don't
                    // we need to check them all?
                    break;
                }
            }
        }
        var n = vxings.length;
        nxings += n;
        if (n % 2)
            inside = !inside;
        while (n--) {
            xings.push (vxings.shift());
        }
        while (nxings >= 2) {
            cutPolySegment (pp, xings, new_polys, cut_folds);
            nxings -= 2;
        }
        if (inside) {

             /* no "edge" indicates this is not an intersection, but a new interior point
            // be sure to copy the point because it will be incorporated
            // into a new polygon and can't be shared by several */

            xings.push ( { pt: copyPoint(v.next) } );
        }
        if (xings.length == 0) {
            pp = null;
        }
        v = v.next;
    } while (v != pcut.points);
    // now xings has all the intersections of pcut with p plus any points of pcut interior to p.
    /*
    if (new_polys.length == 0) {
       trace ("cutPoly: no new polys?");
    }
    */
    for (var i = 0; i < new_polys.length; i++) {
        setPointsPoly (p);
        setPointsPoly (new_polys[i]);
    }
}

function cutPolySegment (p, xings, new_polys, cut_folds)
{
    // trace ("cutPolySegment " + p.id);
    var a, b, a0, b0, a_last, b_last, e, e0;
    var done = false;
    // loop over all intersections and internal points, creating new polygons
    // out of pieces of p.
    while (xings.length > 0 && !done)
    {
        var xing = xings.shift();
        a = copyPoint (xing.pt);
        b = copyPoint (a);
        if (!a0) {
            a0 = a;
            b0 = b;
            if (!xing.edge) 
                trace ("cutPolySegment: first intersection crosses no edge?");
            e0 = xing.edge;
        } else {
            a_last.next = a;
            b.next = b_last;
            if (xing.edge)
                done = true;
        }
        a_last = a;
        b_last = b;
    }
    
    // now close off the polygons depending on the relationship of the entry
    // and exit points - there are three cases:

    var e = xing.edge;  /* (e, e.next) = intersected edge of p */
    var p1 = copyPoly (p);
    new_polys.push (p1);

    var f = e.fold;
    // TBD !!!: this edge is sometimes spurious because of the temporary 
    // settings we make during the cutting process (see XXX below)

    if (e != e0)
    {   // We entered and exited on different edges.
        // Remember the salient points on the folded edges - before losing
        // the links e/e.next and e0/e0.next
        if (f) {
            pushCutFoldPoint (f, a, p.faceup ? cut_folds : null);
            a.fold = f;         /* XXX */
            //b.fold = f;
        }
        if (f = e0.fold) {
            pushCutFoldPoint (f, b0, p.faceup ? cut_folds : null);
            //a0.fold = f;        /* XXX */
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
        if ((Math.abs(a.x-e0.x) + Math.abs(a.y-e0.y)) > 
            (Math.abs(a0.x-e0.x) + Math.abs(a0.y-e0.y)))
        {
            a.next = e0.next;
            b0.next = b;
            e0.next = a0;
        }
        else
        // ... otherwise the a's form the new polygon, and the b's
        // get connected to p.
        {
            a.next = a0;
            b0.next = e0.next;
            e0.next = b;
        }
        if (f) {
            a.fold = f;         /* XXX */
            //a0.fold = f;
            //b.fold = f;
            b0.fold = f;
            pushCutFoldPoint (f, b0, p.faceup ? cut_folds : null);
            pushCutFoldPoint (f, a);
        }
    }
    p.points = a;
    p1.points = b;

    if (!done)
        trace ("cutPolySegment exiting when ! done?");
}

function pushCutFoldPoint (f, v, cutfolds)
{
    if (! f.cutpoints)
    {
        f.cutpoints = new Array;
        if (cutfolds)
            cutfolds.push (f);
    }
    f.cutpoints.push (v);
}

function patchCutFold (f)
{
    var f1 = f.twin;
    // sanity check:
    if (!f.cutpoints || !f1.cutpoints || f.cutpoints.length != f1.cutpoints.length)
    {
        trace ("patchCutFold: fold mismatch detected");
        trace ("patchCutFold: f has " + 
               f.cutpoints.length + ", f1 has " +
               f1.cutpoints.length);
        trace ("patchCutFold: f=(" +
               Math.round(f.v1.x)+","+Math.round(f.v1.y)+"),("+
               Math.round(f.v2.x)+","+Math.round(f.v2.y)+")"
               + " f1=(" +
               Math.round(f1.v1.x)+","+Math.round(f1.v1.y)+"),("+
               Math.round(f1.v2.x)+","+Math.round(f1.v2.y)+")"
               );
        drawDiamond (f.v1, cursor, 0xff0000);
        drawDiamond (f.v2, cursor, 0xff0000);
        drawDiamond (f1.v1, cursor, 0x0000ff);
        drawDiamond (f1.v2, cursor, 0x0000ff);
        for (var i=0; i<f.cutpoints.length; i++) {
            drawDiamond (f.cutpoints[i], cursor, 0x00ff00);
        }
        for (var i=0; i<f1.cutpoints.length; i++) {
            drawDiamond (f1.cutpoints[i], cursor, 0x888800);
        }
        return;
    }
    while (f.cutpoints.length > 0)
    {
        var v = f.cutpoints.pop();
        var v1;
        if (v.next == f.v2) {
            // the start point of the original uncut folded edge f1
            // is added implicitly
            v1 = f1.v1;
        } else {
            // search for the matching point in f1's cutpoints
            var i; 
            v1 = null;
            for (i=0; i<f1.cutpoints.length; i++) {
                v1 = f1.cutpoints[i];
                if (peq(v.next, v1)) {
                    f1.cutpoints.splice (i, 1);
                    break;
                }
            }
            if (!v1) {
                trace ("patchCutFold: no matching cut point found");
            }
        }
        addCutFold (v, v1, f, f1)
    }
    if (f1.cutpoints.length <= 0) {
        trace ("patchCutFold: not enough cutpoints?");
    }
    // the start point of the original uncut folded edge f is added implicitly
    addCutFold (f.v1, f1.cutpoints.pop(), f, f1);
    if (f1.cutpoints.length > 0) {
        trace ("patchCutFold: cutpoints left over in f1");
    }
}

function addCutFold (v, v1, f, f1)
{
    var ff = new Fold (v.poly, v, v.next, f.level);
    // if (!v.fold || v.fold == f)
    v.fold = ff;
    // if (!v.next.fold || v.next.fold == f) 
    //   v.next.fold = ff;

    var ff1 = new Fold (v1.poly, v1, v1.next, f1.level);
    // if (!v1.fold || v1.fold == f1)
        v1.fold = ff1;
        // if (!v1.next.fold || v1.next.fold == f1)
        //  v1.next.fold = ff1;

    ff.twin = ff1;
    ff1.twin = ff;

    // twinned points must be co-located
    if (!peq(v, v1.next) || !peq(v1, v.next))
    {
        trace ("patchCutFold: fold point mismatch, f=(" +
               Math.round(v.x)+","+Math.round(v.y)+"),("+
               Math.round(v.next.x)+","+Math.round(v.next.y)+")"
               + " f1=(" +
               Math.round(v1.x)+","+Math.round(v1.y)+"),("+
               Math.round(v1.next.x)+","+Math.round(v1.next.y)+")"
               );
        drawDiamond (v, cursor, 0xff0000);
        drawDiamond (v.next, cursor, 0xff0000);
        drawDiamond (v1, cursor, 0x0000ff);
        drawDiamond (v1.next, cursor, 0x0000ff);
        error = true;
    }
}

function clearPolyFlags (polys)
{
    for (i = 0; i<npolys; i++) {
        var p = polys[i];
        p.flipme = false;
        p.visited = false;
        p.is_anchor = false;
        p.flipped = false;
    }
}

function reflectMarkedPolys (polys, v1, v2, zlevels)
{
    // trace ("reflectMarkedPolys, z=" + zlevels);
    // dumpPolys (polys);
    npolys = polys.length;
	
    // fold all the marked polygons now.  These will be the ones on the flipme of the
    // fold or connected via earlier folds to one on the flipme.
    for (i = 0; i<npolys; i++) {
        var p = polys[i];
        if (p.flipme && !p.flipped) {
            reflectPoly (p, v1, v2, zlevels);
            // trace ("reflect poly " + p.id);
            p.flipped = true;
        }
        //p.flipme = false;
        //p.visited = false;
        //p.is_anchor = false;
    }
}
 
/* reflectPoly
  * reflect the polygon p about the edge v1=>v1.next, set the z value and flip the
  * polygon's orientation.
  */
  
function reflectPoly (p, v1, v2, zlevels)
{
    var d2 = distanceSquared (v1, v2);
    if (d2 <= 0.01) return;
    var x21 = v2.x - v1.x;
    var y21 = v2.y - v1.y;
    var v = p.points;
    do {
        // loop over all the points in the polygon , compute the value of t
        // that describes the closest point on the edge (v1, v2) to the
        // point v, where the line is written v1 + t(v2-v1).  Then the new
        // reflected point v' is 2 (v1 + t(v2-v1)) - v
        //
        // however if the point lies on the reflection edge then skip it

        if (v == v1 || v == v2) {
            v = v.next;
            continue;
        }
        var t = ((v.x - v1.x) * x21 + (v.y - v1.y) * y21) / d2;
        v.x = 2 * (v1.x + t * (v2.x - v1.x)) - v.x;
        v.y = 2 * (v1.y + t * (v2.y - v1.y)) - v.y;
        v = v.next;
    } while (v != p.points);
    p.z = zlevels - p.z - 1;  // reflect the z-value about the midpoint
    p.faceup = !p.faceup;  // flip the poly over
}
 
/************************************************************************
 * basic polygon geometry and intersection calculations
 ************************************************************************/
 
function distanceSquared (u, v) {
    var dx = (u.x - v.x), dy = (u.y - v.y);
    return dx*dx + dy*dy;
}

/*
 * rhsTest
 *  checks which side of (x1,y1)->(x2, y2) (x,y) is on; returns 
 *  a boolean indicating whether it's on the rhs (or on the line itself).
 */
function rhsTest (x1, y1, x2, y2, x, y)
{
    var px = x - x1;
    var py = y - y1;
    var rx = x2 - x1;
    var ry = y2 - y1;
    return (px*ry - py*rx) <= 0 ? true : false;
}

/*
 * containsPoly
 *  returns a boolean indicating whether a point lies inside a polygon.  Determined by
 *  drawing a line from a point known to be outside the polygon to the point in question.
 *  If the number of intersections of the resulting line segment with the polygon is odd
 *  then the point lies inside the polygon, otherwise it's outside.
 */
 
function containsPoly (p, v)
{
    if (v.x < p.ul.x || v.x > p.br.x || v.y < p.ul.y || v.y > p.br.y)
        return false;
    var vout = new Point (-100, -100);
    var u = p.points;
    var intCount;
    do { 
        if (intersectEdges (vout, v, u, u.next, false)) {
            ++intCount;
        }
        u = u.next;
    } while (u != p.points)
  	return intCount % 2 == 1 ;
}

/*
 * intersectPoly
 *   Returns an array of intersections of a line segment and a polygon,
 *   sorted by distance from the start point of the line segment.
 *   The array contains structs with three elements; 
 *   pt: the point of intersection
 *   edge: the first point on the polygon of the edge on which the intersection lies.
 *   t: parameter values of the line equation (v1 + t *(v2-v1)); used to order the points
 *   If there is no intersection, an empty list is returned.
 */
function intersectPoly (p, v1, v2)
{
    var result = [];
    var param = { };            /* use for function return value since
                                   this language has no explicit references */
    var u = p.points;
    do { 
        var v = intersectEdges (v1, v2, u, u.next, true, param);
        if (v) {
            var i;
            for (i=0; i<result.length; i++) {
                if (result[i].t > param.t) {
                    break;
                }
            }
            result.splice (i, 0, {pt: v, edge: u, t : param.t});
        }
        u = u.next;
    } while (u != p.points);
    return result;
}

function intersectEdges (v1, v2, u1, u2, returnPoint, returnParam)
// test for intersection of line segment e with line segment formed by
// points[i],points[i+1]
//
// If returnPoint is true, the intersection point is returned,
// otherwise simply a Boolean indicating whether or not there is an 
// intersection
{
    // TBD: an overall speedup may result from this bounding box test
    if (! rectOverlap (u1, u2, v1, v2))
        return null;
    var x43 = u2.x - u1.x;
    var y43 = u2.y - u1.y;
    var x21 = v2.x - v1.x;
    var y21 = v2.y - v1.y;
    var denom = y43*x21 - x43*y21;
    if (Math.abs(denom) < 0.01) {
        return null;  // line segments are parallel
    }
    var x13 = v1.x - u1.x;
    var y13 = v1.y - u1.y;
    var t12 = (x43*y13 - y43*x13) / denom;
    if (returnParam) { returnParam.t = t12 };
    if (t12 > 1.0 || t12 < 0.0) {
        return null;  // intersection lies off of line segment e
    }
    var t34 = (x21*y13 - y21*x13) / denom;
    if (t34 > 1.0 || t34 < 0.0) {
        return null;  // intersection lies off of line segment p(i,j)
    }
    // found an intersection - return the point
    return returnPoint ? new Point (v1.x + t12 * x21, v1.y + t12 * y21)
        : true;
}

/**********************************************************************
 * little utilities
 **********************************************************************/

function polyStackComparison(v1, v2) {
    return v2.z-v1.z;
}

function findPrev (v)
{
    var u = v.poly.points;
    while (u.next != v) {
        u = u.next;
    }
    return u;
}

function setPointsPoly (p)
{
    var u = p.points;
    do {
        u.poly = p;
        u = u.next;
    } while (u != p.points) ;
}

function rectOverlap (u1, u2, v1, v2)
{
    if (v2.x > v1.x) { 
        if (u1.x > v2.x) {  
            if (u2.x > v2.x) { 
                return null; 
            }
        } else if (u1.x < v1.x) {
            if (u2.x < v1.x) {
                return null;
            }
        }
    } else {
        if (u1.x < v2.x) {
            if (u2.x < v2.x) {
                return null;
            }
        } else if (u1.x > v1.x) {
            if (u2.x > v1.x) {
                return null;
            }
        }
    }
    if (v2.y > v1.y) {
        if (u1.y > v2.y) {
            if (u2.y > v2.y) {
                return null;
            }
        } else if (u1.y < v1.y) {
            if (u2.y < v1.y) {
                return null;
            }
        }
    } else {
        if (u1.y < v2.y) {
            if (u2.y < v2.y) {
                return null;
            }
        } else if (u1.y > v1.y) {
            if (u2.y > v1.y) {
                return null;
            }
        }
    }
    return true;
}

function polysOverlap (p1, p2)
{
    if (p1.ul.x > p2.br.x ||
        p2.ul.x > p1.br.x ||
        p1.ul.y > p2.br.y ||
        p2.ul.y > p1.br.y) 
    {
        return false; 
    } 
    return true;
}

function getModelBounds (polys, descend)
{
    var left=1000, right=-1000, top=1000, bottom=-1000;
    for (var i =0; i<polys.length; i++) {
        var p = polys[i];
        if (descend)
            computeBoundingBox (p);
        if (p.ul.x < left) left = p.ul.x;
        if (p.br.x > right) right = p.br.x;
        if (p.ul.y < top) top = p.ul.y;
        if (p.br.y > bottom) bottom = p.br.y;
    }
    canvas.bounds = { left: left, top: top, bottom: bottom, right: right };
}

function computeBoundingBox (p)
{
    var left=1000, right=-1000, top=1000, bottom=-1000;
    var u = p.points;
    do {
        if (u.x < left) left = u.x;
        if (u.x > right) right = u.x;
        if (u.y > bottom) bottom = u.y;
        if (u.y < top) top = u.y;
        u = u.next;
    } while (u != p.points);
    if (p.ul) {
        p.ul.x = left;
        p.ul.y = top;
        p.br.x = right;
        p.br.y = bottom;
    } else {
        p.ul = new Point (left, top);
        p.br = new Point (right, bottom);
    }
}

/*
function dumpPolys (polys)
{
    for (var i =0; i<polys.length; i++) {
        dumpPoly (polys[i]);
    }
}

function dumpPoly (p)
{
    trace ("poly " + p.id + ", flipme=" + p.flipme + ", visited=" + 
           p.visited + ", new=" + p.is_anchor + ", faceup=" + 
           p.faceup + ",z=" + p.z);
    var u = p.points;
    var txt = "";
    do {
        txt += "     " + Math.round(u.x) + "," + Math.round(u.y);
        if (u.poly) txt += " p" + u.poly.id;
        if (u.fold) {
            txt += " twin " + u.fold.twin.v1.poly.id;
        }
        trace (txt); txt = "";
        if (u.fold) {
            if (peq(u.fold.v1, u)) {
                if (!peq (u.fold.v2, u.next)) {
                    trace ("  ERROR fold.v2 (" + Math.round(u.fold.v2.x) +
                           "," + Math.round(u.fold.v2.y) +
                           ")doesn't match u.next");
                }
            } else if (!peq (u.fold.v2, u)) {
                trace ("  ERROR neither fold endpoint matches this point");
            }
        }
        if (u.poly && u.poly.id != p.id) {
            trace ("  ERROR point poly id mismatch");
        }
        u = u.next;
    } while (u != p.points);
}

function dumpPolyBrief (p)
{
    var u = p.points;
    var txt = "poly: ";
    do {
        txt += "(" + u.x + "," + u.y + ")";
        u = u.next;
    } while (u != p.points);
    trace (txt);
}

function checkModel(polys)
{
    for (var i = 0; i<polys.length; i++) {
        var pcount = 0;
        do {
            if (u.fold) {
                if (peq(u.fold.v1, u)) {
                    if (!peq (u.fold.v2, u.next)) {
                        trace ("  ERROR fold.v2 (" + Math.round(u.fold.v2.x) +
                               "," + Math.round(u.fold.v2.y) +
                               ")doesn't match u.next");
                    }
                } else if (!peq (u.fold.v2, u)) {
                    trace ("  ERROR neither fold endpoint matches this point");
                }
                if (u.fold.v1 != u) {
                    trace ("u.fold.v1 != u");
                }
                if (u.fold.v2 != u.next) {
                    trace ("u.fold.v2 != u.next");
                }
                if (u.fold.twin.twin != u.fold) {
                    trace ("u.fold.twin.twin != u.fold");
                }
                if (! u.fold.twin.v1.poly.points) {
                    trace ("u.fold.twin.v1.poly.points is null");
                }
                if (!peq (u.fold.v1, u.fold.twin.v2) ||
                    !peq (u.fold.v2, u.fold.twin.v1))
                {
                    trace ("  ERROR fold.twin mismatch  ");
                    drawDiamond (u.fold.v1, cursor, 0x0000ff);
                    drawDiamond (u.fold.v2, cursor, 0x0000ff);
                    drawDiamond (u.fold.twin.v1, cursor, 0xff0000);
                    drawDiamond (u.fold.twin.v2, cursor, 0xff0000);
                }
                if (u.fold.twin == u.fold || 
                    u.fold.twin.v1.poly == u.v1.poly)
                {
                    trace ("   ERROR fold is its own twin?");
                    drawDiamond (u.fold.v1, cursor, 0x0000ff);
                    drawDiamond (u.fold.v2, cursor, 0x0000ff);
                }
            }
            if (u.poly && u.poly.id != p.id) {
                trace ("  ERROR point poly id mismatch");
            }
            u = u.next;
            if (++pcount > 100) {
                trace ("WARNING: poly has > 100 points? possible inf. loop detected");
                break;
            }
        } while (u != p.points);
    }
}
*/

/**********************************************************************
 * data structure functions; constructors, copiers, etc.
 **********************************************************************/

function Point(x, y, v) {
    this.x = x;
    this.y = y;
    this.next = v;
    return this;
    // this.poly = p;
}

function copyPoint (v) {
    var u = new Point (v.x, v.y);
    return u;
}

function peq (v, v1)
{
    return (Math.abs (v.x-v1.x) < 0.0001 &&
            Math.abs (v.y-v1.y) < 0.0001);
}

function deletePoint (v) {
    if (v.fold && v == v.fold.v1) {
        delete v.fold;
    }
    delete v;
}

function Poly() {
    this.points = null;
    this.z = 0;
    this.faceup = true;
    this.fgcolor = 0xdddddd;
	
    // These three flags are used to keep track of which polygons are to be
    // flipped when folding - we might combine them into a bit field...
    this.flipme = false;
    this.visited = false;
    this.is_anchor = false;
	
    this.id = canvas.next_poly_id++;
    return this;
}

function copyPoly (p) {
    var new_poly = new Poly ();
    new_poly.z = p.z;
    new_poly.faceup = p.faceup;
    new_poly.fgcolor = colors[new_poly.id % colors.length];
    return new_poly;
}

function deletePoly (p) {
    var v = p.points;
    var u = v.next;
    v.next = null;
    while (u) {
        var v = u.next;
        deletePoint (u);
        u = v;
    } 
    delete p;
}

function Fold (p, v1, v2, level) {
    this.v1 = v1;
    this.v2 = v2;
    this.level = level;
    this.twin = null;
    return this;
}
