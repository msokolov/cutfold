/*
 * vertex.js
 *
 * (after Vertex.java)
 *  copyright (c) Mike Sokolov, 2002, 2013
 *
 * A Vertex is a point which also may be a vertex of a Polygon, one of a
 * linked list of vertices, and also represents the line segment (the edge
 * of the polygon) starting at that vertex.
 */

function Vertex (x, y, v) {
    id = Vertex.next_id++;
    this.x = x;
    this.y = y;
    this.next = v;
    // a crease is a line segment drawn across a polygon, effectively cutting it in two
    this.is_crease = false;
    this.fold = null;
    this.poly = null;
}

Vertex.next_id = 1

Vertex.prototype.create = function (x, y) {
    return new Vertex(x, y, null);
}

Vertex.prototype.copy = function () {
    var copy = new Vertex (this.x, this.y);
    copy.is_crease = this.is_crease;
    return copy;
}

Vertex.prototype.xml = function () {
    var xml= "<vertex id=\"" + this.id + "\" x=\"" + this.x + 
        "\" y=\"" + this.y + "\" is_crease=\"" + this.is_crease + "\">";
    if (this.fold != null) {
        xml += "<fold twin=\"" + this.fold.twin.v.id + "\" level=\"" + 
            this.fold.level + "\" index=\"" + this.fold.index + "\">";
    }
    xml += "</vertex>";
    return xml;
}

Vertex.prototype.findPrev = function () {
    // find the Vertex prior to this one in its polygon's
    // one-way linked list of vertices
    var u = this.poly.points;
    while (u.next != this) {
        u = u.next;
    }
    return u;
}

Vertex.prototype.join = function (other) {
    // Join two edges together by eliminating redundant points
    // It is assumed here that other.eq(next)
    if (! other.eq(next)) {
        console.error ("ERROR: attempt to join distal vertices");
        return;
    }
    if (this.parallel (other)) {
        // In the case where the two edges are also parallel 
        // (thus colinear, since they share a point), then we can eliminate two edges
        // and we also need to patch up the fold structure
        this.next = other.next;

        // Twin folds: whenever a polygon is split (by folding), two
        // congruent line segments are created, pointing in opposite
        // directions, and linked to the two halves of the original
        // polygon.  These are said to be twins (you might not like to
        // think of them as siamese twins joined head to foot).

        // Fix the twin fold, if any.  This would be from a fold that predates the current fold.
        // This is the mirror operation of Fold.unfold.
        // Check fold.other_twin; if it is set then we were already handled by our twin;
        // otherwise set fold.twin.other_twin to let our twin know we got here first
        var fold = this.fold;
        if (fold != null) {
            if (fold.other_twin == null) {
                fold.twin = other.fold.twin;
                fold.twin.twin = fold.twin.other_twin = fold;
                other.fold = null;
            } else {
                fold.other_twin = null;
            }
        }
    } else {
        this.next = other;
    }
}

Vertex.prototype.distanceSquared = function (v) {
    var dx = (this.x - v.x);
    var dy = (this.y - v.y);
    return dx*dx + dy*dy;
}

Vertex.prototype.eq = function (v) {
    return (Math.abs (v.x-this.x) < 0.0001 &&
            Math.abs (v.y-this.y) < 0.0001);
}

Vertex.prototype.parallel = function (v) {
    var x = this.x;
    var y = this.y;
    var next = this.next;
    if (Math.abs(next.x - x) < 0.01) {
        return Math.abs(v.next.x - v.x) < 0.01;
    }
    var ratio = (next.x - x) / (v.next.x - v.x);
    return Math.abs ((v.next.y - v.y) * ratio - (next.y - y)) < 0.01;
}

Vertex.prototype.intersectEdges = function (u1, treturn) {

    /* Tests for intersection of line segment (this,next) with line segment
     * (u1,u1.next) the point of intersection is returned, or null if the line
     * segments do not intersect.
     * If treturn is not null, the value of the t parameter is returned
     * as treturn[0], where t in [0,1] indicates that the line segments
     * intersect
     */

    var u2 = u1.next;
    var v1 = this;
    var v2 = this.next;

    if (! Vertex.rectOverlap (v1, v2, u1, u2)) {
        // quick bounding box test
        return null;
    }

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
    if (treturn != null) { treturn[0] = t12; }
    // I changed this test since if you cut right along the edge of a polygon
    // you would end up with a weird infinitely-thin polygon.  But this 
    // happened when double clicking (thus closing) a single-segment polygon.
    //if (t12 > 1.0001 || t12 < -0.0001) {
    if (t12 >= 1.0 || t12 <= 0.0) {
        return null;  // intersection lies off of line segment v1,v2
    }
    var t34 = (x21*y13 - y21*x13) / denom;
    if (t34 >= 1.0 || t34 <= 0.0) {
        return null;  // intersection lies off of line segment u1,u2
    }
    // found an intersection - return the point
    var result = new Vertex (v1.x + t12 * x21, v1.y + t12 * y21);
    // remember z component of cross-product of the two intersecting edges - 
    // it indicates the "handedness" of the intersection
    result.r = denom;
    result.is_crease = u1.is_crease;
    return result;
}

Vertex.prototype.intersectTest = function (u1) {
// Works just like intersectEdge except it only returns a boolean
// and never allocates any objects, so it's a little faster in the
// case where we don't need to know where the intersection was.
    var u2 = u1.next;
    var v1 = this;
    var v2 = this.next;

    if (! Vertex.rectOverlap (v1, v2, u1, u2)) {
        return false;
    }

    var x43 = u2.x - u1.x;
    var y43 = u2.y - u1.y;
    var x21 = v2.x - v1.x;
    var y21 = v2.y - v1.y;
    var denom = y43*x21 - x43*y21;
    if (Math.abs(denom) < 0.01) {
        return false;  // line segments are parallel
    }
    var x13 = v1.x - u1.x;
    var y13 = v1.y - u1.y;
    var t12 = (x43*y13 - y43*x13) / denom;
    if (t12 > 1.0001 || t12 < -0.0001) {
        return false;  // intersection lies off of line segment v1,v2
    }
    var t34 = (x21*y13 - y21*x13) /  denom;
    if (t34 > 1.0001 || t34 < -0.0001) {
        return false;  // intersection lies off of line segment u1,u2
    }
    return true;
}

Vertex.rectOverlap = function (v1, v2, u1, u2) {
    if (v2.x > v1.x) { 
        if (u1.x > v2.x) {  
            if (u2.x > v2.x) { 
                return false; 
            }
        } else if (u1.x < v1.x) {
            if (u2.x < v1.x) {
                return false;
            }
        }
    } else {
        if (u1.x < v2.x) {
            if (u2.x < v2.x) {
                return false;
            }
        } else if (u1.x > v1.x) {
            if (u2.x > v1.x) {
                return false;
            }
        }
    }
    if (v2.y > v1.y) {
        if (u1.y > v2.y) {
            if (u2.y > v2.y) {
                return false;
            }
        } else if (u1.y < v1.y) {
            if (u2.y < v1.y) {
                return false;
            }
        }
    } else {
        if (u1.y < v2.y) {
            if (u2.y < v2.y) {
                return false;
            }
        } else if (u1.y > v1.y) {
            if (u2.y > v1.y) {
                return false;
            }
        }
    }
    return true;
}

Vertex.prototype.string = function () {
    if (this.next) {
        return "(" + Math.round(this.x) + "," + Math.round(this.y) + ")->(" + 
            Math.round(this.next.x) + "," + Math.round(this.next.y) + ")";
    } else {
        return "(" + Math.round(this.x) + "," + Math.round(this.y) + ")";
    }
}

