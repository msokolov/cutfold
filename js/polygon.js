/*
 * polygon.js (after Polygon.java)
 *
 *  Copyright (c) Mike Sokolov, 2002, 2013
 *
 * A Polygon is made of a singly linked list of Vertices (see vertex.js).
 * The "top" is defined by the right hand rule, following the direction of
 * the linked list.
 */

function Polygon (p) {
    /* If p is passed, a deep copy is made.  Otherwise a blank new Polygon is created. */
    if (p) {
        this.id = p.id;
        this.z = p.z;
        this.faceup = p.faceup;
        this.fgcolor = p.fgcolor;

        this.flipme = p.flipme;
        this.visited = p.visited;
        this.is_anchor = p.is_anchor;

        // deep copy the vertex list
        var v = p.points;
        var u = v.copy();
        this.points = u;
        for (;;) {
            // don't copy folds
            v = v.next;
            if (v == p.points) {
                u.next = this.points;
                break;
            }
            var u1 = v.copy();
            u.next = u1;
            u = u1;
        }
        this.setPointsPoly ();
    } else {
        this.points = null;
        this.id = Polygon.next_id++;
        this.z = 0;
        this.faceup = true;
        this.fgcolor = Polygon.colors[id%10];

        // These three flags are used to keep track of which polygons are to be
        // flipped when folding - we might combine them into a bit field...
        this.flipme = false;
        this.visited = false;
        this.is_anchor = false;
    }
}

Polygon.next_id = 0;

/*
allocate scratch arrays to avoid garbage?
*/
Polygon.xpoints = []; Polygon.xpoints.length = 1024;
Polygon.ypoints = []; Polygon.ypoints.length = 1024;

Polygon.defcolor = "#aaaaaa";
Polygon.crease_color = "#666688";
Polygon.colors = ["#444488", "#774477", "#663344", "#446633", "#333366", "#666666", "#884488", "#992222", "#229922", "#222299",];

Polygon.prototype.similar = function () {
    // make a "similar' polygon
    var new_poly = new Polygon ();
    new_poly.z = this.z;
    new_poly.faceup = this.faceup;
    new_poly.fgcolor = Polygon.colors[new_poly.id % Polygon.colors.length];
    return new_poly;
}

Polygon.prototype.computeBoundingBox = function () {
    this.left  = 1000;
    this.right =-1000;
    this.top   = 1000;
    this.bottom=-1000;
    var u = this.points;
    do {
        if (u.x < this.left) this.left = u.x;
        if (u.x > this.right) this.right = u.x;
        if (u.y > this.bottom) this.bottom = u.y;
        if (u.y < this.top) this.top = u.y;
        u = u.next;
    } while (u != null && u != this.points);
}

Polygon.prototype.clearFlags = function () {
    this.flipme = false;
    this.visited = false;
    this.is_anchor = false;
    this.flipped = false;
}

Polygon.prototype.draw = function (canvas, xoff, yoff, scale, show_vertices) {
    var v = this.points;
    if (v == null)
        return;
    var n = 0;
    do {
        Polygon.xpoints[n] = Math.round(v.x * scale) + xoff;
        Polygon.ypoints[n++] = Math.round(v.y * scale) + yoff;
        v = v.next;
    } while (v != this.points);
    // console.debug ("scale=" + scale + ", n=" + n);
    this.doDraw (canvas, n, show_vertices);
}

Polygon.prototype.tween = function (p1, canvas, xoff, yoff, scale, t, rotation_style) {
    var n = 0;
    var v = this.points, v1 = p1.points;
    var x, y, s;
    // 0 <= t <= 1; t' = (1-cos(PI * t))/2; 0<=t'<=1 also, but sinusoidally...
    s = (1 - Math.cos (t * Math.PI)) / 2;
    if (v == null || v1 == null) {
        console.warn ("polygon.tween: one of the polys has no points?");
        return;
    }
    do {
        x = v.x + s * (v1.x - v.x);
        y = v.y + s * (v1.y - v.y);
        if (rotation_style != 0 && v.x != v1.x) {
            // rotation_style = 1 is used when folding, 2 when spinning.
            // perspective xform - vanishing point is 0,0 ; always the center of the screen
            // compute z using v.r which stores the distance of the point from an axis
            // about which it's being rotated
            // TBD - if the model is not centered on 0,0 we need to use its center as the 
            // vanishing point instead (can use model bounds)
            var z = (rotation_style == 2 ? (- v1.r) : Math.abs (v1.r));
            z *= Math.sin (t * Math.PI);
            x = 250 * x / (250 + z);
            y = 250 * y / (250 + z);
        }
        Polygon.xpoints[n] = Math.round(x * scale) + xoff;
        Polygon.ypoints[n++] = Math.round(y * scale) + yoff;
        v = v.next;
        v1 = v1.next;
    } while (v != this.points && v1 != p1.points);
    if (t < 0.5) {
        this.doDraw (canvas, n, false);
    } else {
        // get the color right
        p1.doDraw (canvas, n, false);
    }
}

Polygon.prototype.doDraw = function (g, n, show_vertices) {
    g.fillStyle = this.faceup ? Polygon.colors[this.z % Polygon.colors.length] : Polygon.defcolor;
    //console.debug ("Polygon.doDraw " + this.id + " color=" + g.fillStyle);
    this.fillPolygon (g, Polygon.xpoints, Polygon.ypoints, n);

    var xpoints = Polygon.xpoints;
    var ypoints = Polygon.ypoints;
    xpoints[n] = xpoints[0];
    ypoints[n] = ypoints[0];
    var i = 0;
    var v = this.points;
    g.strokeStyle = "#000"; // draw black lines
    do {
        if (! v.is_crease) {
            g.moveTo (xpoints[i], ypoints[i]);
            g.lineTo (xpoints[i+1], ypoints[i+1]);
        } 
        else if (true) {
            // show creases for diagnostic purposes:
            g.strokeStyle = Polygon.crease_color;
            g.moveTo (xpoints[i], ypoints[i]);
            g.lineTo (xpoints[i+1], ypoints[i+1]);
            g.strokeStyle = "#000"; // draw black lines
        }
        // show vertices for diagnostic purposes:
        if (show_vertices) {
            g.rect (xpoints[i]-1, ypoints[i]-1, 2, 2);
            g.fillText (i + "", xpoints[i]-4 * i, ypoints[i]+12);
        }
        v = v.next;
        ++i;
    } while (v != this.points && i < n);
    g.fill();
    g.stroke();
}

Polygon.prototype.fillPolygon = function (g, xp, yp, n) {
    g.beginPath();
    g.moveTo (xp[0], yp[0]);
    //console.debug ("  moveTo (" + xp[0] + "," + yp[0] +")");
    for (var i = 1; i < n; i++) {
        //console.debug ("  lineTo (" + xp[i] + "," + yp[i] +")");
        g.lineTo (xp[i], yp[i]);
    }
    g.closePath();
    g.fill();
}

Polygon.prototype.compareTo = function (other) {
     // higher z is further away from viewer (polys w/lower z obscure those w/higher)
    return otherp.z - z;
}

/*
 * fold splits a polygon in two with a line segment, creating a new
 * polygon, modifying this polygon and connecting the two with a pair of
 * twinned folds.
 */

Polygon.prototype.fold = function (v, new_polys, fold_level, fold_index) {
    var intersections = this.intersect (v, null);
    // console.debug ("polygon.fold: intersections.length=" + intersections.length);
    if (intersections.length < 2) {
        return;	// Ignore snips into the interior that leave the polygon whole
    }
    var inp = this.contains(v);
    if (inp && intersections.length < 3) {
        return;	// Ignore snips from the interior to the interior that never
        // leave the polygon 
    }
    if (inp) {
        // ignore the first intersection since it's just incidental if we started 
        // inside the polygon
        intersections.shift(); // TBD delete me?
    }
    while (intersections.length > 1)
    {	 
        /* Create a new poly from one side of the fold. In the new poly,
           the dividing edge contains the points b, a in the sequence:
           b0->b->a->a0.next.  Also modify the existing poly to contain the
           new edge in the sequence: a0->a->b->b0.next
           (a0,a0.next,b0,b0.next are points in the original polygon. */

        var a_int = intersections.shift();
        var a = a_int.pt;
        var a0 = a_int.edge;
        var fa = a0.fold;
		    
        var b_int = intersections.shift();
        var b = b_int.pt;
        var b0 = b_int.edge;
        var fb = b0.fold;
		    
        var p1 = this.similar ();

        // clone b and a for the new poly and set up the fold structure
        // linking them and their polygons together
        var b1 = b.copy ();
        var a1 = a.copy ();
        // TBD - we used to record b in this fold as v2?
        var f = new Fold (a, fold_level, fold_index);
        a.fold = f; 
        // TBD - we used to record a1 in this fold as v2?
        var f1 = new Fold (b1, fold_level, fold_index);
        b1.fold = f1; 
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
        this.points = a;  // may be redundant, but sometimes needed...
		    
        // set the poly links of all the points in p and p1
        this.setPointsPoly ();
        p1.setPointsPoly ();
		    
        // mark these polys as having determinate flippedness
        p1.is_anchor = true;
        this.is_anchor = true; 
			  
        // determine which poly is on the right hand side of the fold and mark it.
        if (this.faceup) {
            this.flipme = true;
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

/*
 * FIXME: OK this and the next function are the most complicated functions
 * here, and they don't really have much documentation.
 */

Polygon.prototype.cut = function (pcut, new_polys, cut_folds) {
    // see if v is inside p (and remember a "nearby" intersection)
    var inside, start_inside, pcut_enclosed;
    var outer_xings;
    /* In order to cut this polygon, pcut must enter and leave the polygon
     */
    start_inside = inside = this.encloses (pcut.points);
    var xings = [];
    // OK umm we really need to check whether any of the cutting polygon's 
    // edges intersect any of this polygon's edges.  Only if the cutting 
    // polygon is completely enclosed in this polygon do we need to 
    // create a pseudo-edge as we do below:
    pcut_enclosed = false;
    if (inside) {
        if (!this.intersectsPoly (pcut)) {
            // find the nearest point on the perimiter of this polygon 
            // to the interior point v, and begin cutting from there.
            var v = new Vertex (pcut.points.x, pcut.points.y);
            var ep = [];
            this.near (v.x, v.y, null, v, 100, ep);
            xings.push (new Intersection (v, ep[0], 0, true));
            v = pcut.points;
            xings.push (new Intersection (v, null, 0, false));
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
            var vxings = null;
            while (vxings == null && pcut.points.next != null) {
                vxings = this.intersect (pcut.points, null);
                if (vxings.length == 0) vxings = null;
                pcut.points = pcut.points.next;
            } 
            if (vxings.length % 2 == 1) {
                // If there are an odd number of intersections, we found a
                // point on pcut outside the polygon, so just start there.
                inside = false;
            } else {
                // We only keep the last intersection if there are several
                // since the others will be rediscovered as we loop back
                // around pcut
                while (vxings.length > 1) {
                    vxings.shift();
                }
                xings.push (vxings.shift ());
                xings.push (new Intersection (pcut.points, null, 0, false));
            }
        }
    }
    // For each line segment in pcut,
    // check for intersections with this polygon.
    var v = pcut.points;
    do {
        // Check for intersections with this poly and any new polys 
        // created by cutting it with a previous edge of pcut.
        var vxings = this.intersect (v, null);
        for (var i = 0; i < new_polys.length; i++) {
            var q = new_polys[i];
            vxings = q.intersect (v, vxings);
        }
        // Add the intersections to the xings Vector, keeping track of whether we're inside
        // or outside the set of polygons {this, { new_polys } }
        while (vxings.length > 0) {
            var xing = vxings.shift();
            if (xing.t < 0.02) {
                // the xing is right at v
                inside = this.faceup ? (xing.pt.r > 0) : (xing.pt.r <= 0);
            } else if (xing.t > 0.98) {
                // The xing is right at v.next ignore the endpoint unless it's the
                // last of pcut; otherwise it'll be the same as the next v.
                if (v.next.next != null) {
                    xing = null;
                }
                if (vxings.length > 0) {
                    console.error ("intersections not sorted as we thought?  This should be the last one...\n");
                }
                // Don't treat v.next as an interior point when it lies on the 
                // polygon's edge.  Basically think of the cutting edge as a half-open
                // interval
                inside = false;
            } else {
                inside = ! inside;
            }
            if (xing != null) {
                xings.push (xing);
            }
        }
        if (inside) {
            // no "edge" indicates this is not an intersection, but a new 
            // interior point.  Be sure to copy the point because it will be 
            // incorporated into a new polygon and can't be shared 
            if (v.next == pcut.points) {
                xings.push (new Intersection (v.next.copy(), null, 0, true));
                if (pcut_enclosed) {
                    // If the last point is inside, and this polygon
                    // completely encloses pcut, append the nearest edge
                    // point.  Note: if pcut is not enclosed, it means
                    // that it crosses this polygon somewhere and we 
                    // don't need to do this.
                    var w = new Vertex (v.next.x, v.next.y);
                    var ep = [];
                    this.near (w.x, w.y, null, w, 100.0, ep);
                    xings.push (new Intersection (w, ep[0], 1.0, false));
                }
                // set flag to call cutSegment in next block
                inside = false;
            } else {
                xings.push (new Intersection (v.next.copy(), null, 0, false));
            }
        }
        if (! inside) {
            while (xings.length >= 2) {
                var xing = xings[0];
                if (xing.edge == null) {
                    // discard external vertices
                    xings.shift();
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
    this.setPointsPoly ();
    for (var i = 0; i < new_polys.length; i++) {
        new_polys[i].setPointsPoly ();
    }
}

Polygon.prototype.cutSegment = function (xings, new_polys, cut_folds) {
    var a = null, b = null, a0 = null, b0 = null, a_last = null;
    var b_last = null, e, e0 = null;
    var done = false;
    // loop over all intersections and internal points, creating new polygons
    // out of pieces of p.
    var xing = null;
    while (xings.length > 0 && !done)
    {
        xing = xings.shift();
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
    var p1 = this.similar ();
    new_polys.push (p1);

    var f = e.fold;

    if (e != e0) {  
        // We entered and exited on different edges.
        // Remember the salient points on the folded edges - before losing
        // the links e/e.next and e0/e0.next
        if (f != null) {
            f.pushCutFoldPoint (a, this.faceup ? cut_folds : null);
            a.fold = f;
        }
        if ((f = e0.fold) != null) {
            f.pushCutFoldPoint (b0, this.faceup ? cut_folds : null);
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
        var a_same_spin, degenerate = false;
        var a_dist = (Math.abs(a.x-e0.x) + Math.abs(a.y-e0.y));
        var a0_dist = (Math.abs(a0.x-e0.x) + Math.abs(a0.y-e0.y));
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
            var cpsum = 0;
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
            a_same_spin = ((cpsum < 0) != this.faceup);
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
                    f.pushCutFoldPoint (a, this.faceup ? cut_folds : null);
                } else {
                    b0.fold = f;
                    f.pushCutFoldPoint (b0, this.faceup ? cut_folds : null);
                }
            } else {
                a.fold = f;
                b0.fold = f;
                f.pushCutFoldPoint (b0, this.faceup ? cut_folds : null);
                f.pushCutFoldPoint (a, null);
            }
        }
    }

    this.points = a;
    this.setPointsPoly();

    p1.points = b;
    p1.setPointsPoly();
}

/*
 * let each of the vertices in this polygon's list of vertices point to this polygon
 */
Polygon.prototype.setPointsPoly = function () {
    var u = this.points;
    do {
        u.poly = this;
        u = u.next;
    } while (u != this.points);
}

/* markFoldedPolys 
   Walks the polygon graph, marking all polygons that
   can be reached without crossing the fold cohort indicated by
   fold_index.  */

Polygon.prototype.markFoldedPolys = function (fold_index, parent) {
    if (this.visited) {
        return;   // stop this thing from going on forever
    }
    this.visited = true;
    this.flipme = true;
    // System.out.println ("markFolded Poly p " + id);
    var v = this.points;
    do {
        var f = v.fold; 
        var p1;
        if ((f != null) && ((p1 = f.twin.v.poly) != parent))
        {
            if (f.index != fold_index) {
                // don't cross the fold 
                p1.markFoldedPolys (fold_index, this);
            }
        }
        v = v.next;
    } while (v != this.points);
}

/* markPolyGraph
  * Walk a graph of polys, following fold_poly links, setting each polygon's
  * flipme flag so as to indicate its side of the fold_index cohort of folds
  */
  
Polygon.prototype.markPolyGraph = function (flipping, parent, fold_index) {
    if (this.visited) {
        return;   // stop this thing from going on forever
    }
    this.visited = true;
    if (this.is_anchor) {
        // The newly split polygons are like islands of certainty in a sea of doubt...
        flipping = this.flipme;
    } else {
        this.flipme = flipping;
    }
    // System.out.println ("markPolyGraph p" + id + (flipme ? " x " : " o "));
    var v = this.points;
    do {
        // recurse through folds, including the current one.
        // the parent test is not strictly necessary - 
        // it just saves some useless recursions
        var f = v.fold; 
        var p1;
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
    } while (v != this.points);
}

/* ============================================================================= */
/*                                   GEOMETRY                                    */
/* ============================================================================= */

Polygon.prototype.intersectsPoly = function (p) {
    var u = this.points;
    do {
        var v = p.points;
        do {
            if (u.intersectTest (v)) {
                return true;
            }
            v = v.next;
        } while (v != null && v != p.points);
        u = u.next;
    } while (u != null && u != this.points);
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
 
Polygon.prototype.contains = function (v) {
    if (v.x < this.left || v.x > this.right || v.y < this.top || v.y > this.bottom) {
        return false;
    }
    var vout = new Vertex (-200, -200);
    vout.next = v;
    var u = this.points;
    var intCount = 0;
    do { 
        if (vout.intersectTest (u)) {
            ++intCount;
        }
        u = u.next;
    } while (u != this.points);
    return intCount % 2 == 1 ;
}

Polygon.prototype.encloses = function (v) {
    // This is just like contains, but returns false if v lies on
    // or very near an edge of the Polygon
    if (this.near (v.x, v.y, v.next, null, 0.1, null) < 0.0001) {
        return false;
    }
    return this.contains (v);
}

/*
 * near
 *
 * A point is near a polygon if it is within max_dist of one of the 
 * polygon's edges.  near returns the distance of the nearest point on the 
 * polygon's perimeter to the point x,y that is less than max_dist.
 * In the case that such a point is found, it is returned in v.
 * If there is no such point, near returns max_dist unchanged.
 *
 * (x, y) - the point to test for nearness
 *
 * next - the next point after (x, y); indicates the orientation of the 
 * line segment starting at (x, y)
 *
 * v - a Vertex that will hold the nearest point on this polygon to (x, y),
 * or null.
 *
 * max_dist - if (x, y) is farther than this, it is not near
 *
 * ep - an edge pointer that will get the edge that (x, y) is nearest to,
 * or null.

 * near() returns the distance from (x, y) to this, if it is near,
 * otherwise it returns max_dist. If (x, y) is near, and ep is not null, it
 * is set to the nearest edge (represented by a vertex on this
 * polygon). Also if (x,y) is near and v is not null, it is set to the
 * nearest point on that edge.
 */
Polygon.prototype.near = function (x, y, next, v, max_dist, ep) {
    if (x < this.left - max_dist || x > this.right + max_dist ||
        y < this.top - max_dist || y > this.bottom + max_dist) {
        return max_dist;
    }
    var u = this.points;
    var min_dist = max_dist;
    do {
        var ux = u.next.x - u.x;
        var uy = u.next.y - u.y;
        var vx = x - u.x;
        var vy = y - u.y;
        var uv = (ux*vx + uy*vy);
        var u2 = (ux*ux + uy*uy);
        var v2 = (vx*vx + vy*vy);
        var t =  uv / u2;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        // sometimes numerical error causes the operand of sqrt
        // to be slightly negative when the theoretical value should be 
        // zero so we need to take the abs first
        var d = Math.sqrt (Math.abs(v2 - t * uv));
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
    } while (u != this.points);
    return min_dist;
}

/*
 * intersect
 *   Returns an array of intersections of line segment v and this polygon,
 *   sorted by distance from the start point of the line segment.
 *   If the result argument is not null, intersections are added to it.  It is assumed
 *   to be sorted.
 *   The array contains objects (Intersections) with three elements; 
 *   pt: the point of intersection
 *   edge: the first point on the polygon of the edge on which the intersection lies.
 *   t: parameter values of the line equation (v1 + t *(v2-v1)); used to order the points
 *   If there is no intersection, an empty list is returned.
 */

Polygon.prototype.intersect = function (v, result) {
    if (!result) {
        result = [];
    }
    param = [0];
    var u = this.points;
    do { 
        var w = v.intersectEdges (u, param);
        // console.debug (v.string() + " intersect " + u.string() + "=" + w + "," + param[0]);
        if (w) {
            var i;
            for (i=0; i<result.length; i++) {
                if (result[i].t > param[0]) {
                    break;
                }
            }
            result.splice(i, 0, new Intersection (w, u, param[0], false));
        }
        u = u.next;
    } while (u != this.points);
    return result;
}
 
Polygon.prototype.overlaps = function (p) {
    return (this.left <= p.right && p.left <= this.right &&
            this.top <= p.bottom && p.top <= this.bottom) ;
}

Polygon.prototype.compute_axis_distances = function (axis) {
    var v = this.points;
    do {
        v.r = axis.distance (v.x, v.y);
        v = v.next;
    } while (v != this.points);
}

/* reflect the polygon about the edge v1=>v2, set the z value and
 * flip the polygon's orientation.
 */
  
Polygon.prototype.reflect = function (v1, v2, zlevels) {
    // System.out.println ("reflect p " + id);
    var d2 = v1.distanceSquared (v2);
    if (d2 <= 0.01) return;
    var x21 = v2.x - v1.x;
    var y21 = v2.y - v1.y;
    var v = this.points;
    do {
        // loop over all the points in the polygon, compute the value of t
        // that describes the closest point on the edge (v1, v2) to the
        // Vertex v, where the line is written v1 + t(v2-v1).  Then the new
        // reflected Vertex v' is 2 (v1 + t(v2-v1)) - v
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
    } while (v != this.points);
    this.z = zlevels - this.z - 1;    // reflect the z-value about the midpoint
    if (this.z < 0) { this.z = 0; }   // I think we have an error condition somewhere...
    this.faceup = !this.faceup;       // flip the poly over
}

Polygon.sort = function (polys, ascending) {
    if (ascending) {
        polys.sort (function(a,b) { return a.z - b.z });
    } else {
        polys.sort (function(a,b) { return b.z - a.z });
    }
}

Polygon.prototype.xml = function () {
    var xml = "<polygon id=\"" + this.id + "\" faceup=\"" + this.faceup + "\" z=\"" + this.z + "\">";
    var u = this.points;
    do {
        xml += "\n  " + u.xml();
        u = u.next;
    } while (u != this.points);
    xml += "\n</polygon>";
    return xml;
}

Polygon.prototype.string = function () {
    var s = "[";
    var u = this.points;
    do {
        s += u.string();
        u = u.next;
    } while (u != this.points);
    s += "]";
    return s;
}

