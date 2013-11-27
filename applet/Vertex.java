/*
 * Vertex.java
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

public class Vertex {

public int id;
public double x;
public double y;
public double r;
public Vertex next;
public Fold fold;
public Polygon poly;
public boolean is_crease;

private static int next_id = 1;

public Vertex (double x, double y, Vertex v) {
    id = next_id++;
    this.x = x;
    this.y = y;
    next = v;
    is_crease = false;
}

public Vertex (double x, double y) {
    id = next_id++;
    this.x = x;
    this.y = y;
    is_crease = false;
}

public Vertex copy () {
    Vertex v = new Vertex (x, y);
    v.is_crease = is_crease;
    return v;
}

public String xml () {
    String xml= "<vertex id=\"" + id + "\" x=\"" + x + 
        "\" y=\"" + y + "\" is_crease=\"" + is_crease + "\">";
    if (fold != null) {
        xml += "<fold twin=\"" + fold.twin.v.id + "\" level=\"" + 
            fold.level + "\" index=\"" + fold.index + "\">";
    }
    xml += "</vertex>";
    return xml;
}

public Vertex findPrev () {
    // find the Vertex prior to this one in its polygon's
    // one-way linked list of vertices
    Vertex u = poly.points;
    while (u.next != this) {
        u = u.next;
    }
    return u;
}

public void join (Vertex other) {
    // Join two edges together by eliminating redundant points
    // It is assumed here that other.eq(next)
    if (! other.eq(next)) {
        System.out.println ("ERROR: attempt to join distal vertices");
    }
    if (this.parallel (other)) {
        // In the case where the two edges are also parallel 
        // (thus colinear, since they share a point), then we can eliminate two edges
        // and we also need to patch up the fold structure
        next = other.next;

        // fix the twin fold, if any.  This would be from a fold that predates the current fold.
        // This is the mirror operation of Fold.unfold.
        // Check fold.other_twin; if it is set then we were already handled by our twin;
        // otherwise set fold.twin.other_twin to let our twin know we got here first
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
        next = other;
    }
}

public double distanceSquared (Vertex v) {
    double dx = (x - v.x), dy = (y - v.y);
    return dx*dx + dy*dy;
}

public boolean eq (Vertex v) {
    return (Math.abs (v.x-x) < 0.0001 &&
            Math.abs (v.y-y) < 0.0001);
}

public boolean parallel (Vertex v) {
    if (Math.abs(next.x - x) < 0.01) {
        return Math.abs(v.next.x - v.x) < 0.01;
    }
    double ratio = (next.x - x) / (v.next.x - v.x);
    return Math.abs((v.next.y - v.y) * ratio - (next.y - y)) < 0.01;
}

public Vertex intersectEdges (Vertex u1, double treturn[]) {

    Vertex u2 = u1.next;
    Vertex v1 = this;
    Vertex v2 = next;

    if (! rectOverlap (v1, v2, u1, u2))
        return null;

    /* Tests for intersection of line segment v1,v2 with line segment
     * u1,u2 the point of intersection is returned, or null if the line
     * segments do not intersect.
     * If treturn is not null, the value of the t parameter is returned
     * as treturn[0], where t in [0,1] indicates that the line segments
     * intersect
     */

    double x43 = u2.x - u1.x;
    double y43 = u2.y - u1.y;
    double x21 = v2.x - v1.x;
    double y21 = v2.y - v1.y;
    double denom = y43*x21 - x43*y21;
    if (Math.abs(denom) < 0.01) {
        return null;  // line segments are parallel
    }
    double x13 = v1.x - u1.x;
    double y13 = v1.y - u1.y;
    double t12 = (x43*y13 - y43*x13) / denom;
    if (treturn != null) { treturn[0] = t12; }
    // I changed this test since if you cut right along the edge of a polygon
    // you would end up with a weird infinitely-thin polygon.  But this 
    // happened when double clicking (thus closing) a single-segment polygon.
    //if (t12 > 1.0001 || t12 < -0.0001) {
    if (t12 >= 1.0 || t12 <= 0.0) {
        return null;  // intersection lies off of line segment v1,v2
    }
    double t34 = (x21*y13 - y21*x13) /  denom;
    if (t34 >= 1.0 || t34 <= 0.0) {
        return null;  // intersection lies off of line segment u1,u2
    }
    // found an intersection - return the point
    Vertex result = new Vertex (v1.x + t12 * x21, v1.y + t12 * y21);
    // remember z component of cross-product of the two intersecting edges - 
    // it indicates the "handedness" of the intersection
    result.r = denom;
    result.is_crease = u1.is_crease;
    return result;
}

public boolean intersectTest (Vertex u1) {
// Works just like intersectEdge except it only returns a boolean
// and never allocates any objects, so it's a little faster in the
// case where we don't need to know where the interesection was.
    Vertex u2 = u1.next;
    Vertex v1 = this;
    Vertex v2 = next;

    if (! rectOverlap (v1, v2, u1, u2))
        return false;

    double x43 = u2.x - u1.x;
    double y43 = u2.y - u1.y;
    double x21 = v2.x - v1.x;
    double y21 = v2.y - v1.y;
    double denom = y43*x21 - x43*y21;
    if (Math.abs(denom) < 0.01) {
        return false;  // line segments are parallel
    }
    double x13 = v1.x - u1.x;
    double y13 = v1.y - u1.y;
    double t12 = (x43*y13 - y43*x13) / denom;
    if (t12 > 1.0001 || t12 < -0.0001) {
        return false;  // intersection lies off of line segment v1,v2
    }
    double t34 = (x21*y13 - y21*x13) /  denom;
    if (t34 > 1.0001 || t34 < -0.0001) {
        return false;  // intersection lies off of line segment u1,u2
    }
    return true;
}

public static boolean rectOverlap 
    (Vertex v1, Vertex v2, Vertex u1, Vertex u2) {
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

}
