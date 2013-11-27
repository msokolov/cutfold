public class Intersection {
    Vertex pt;                  // the location of the intersection
    Vertex edge;                // the intersected edge of a polygon  (edge -> edge.next)
    double t;                   // the normalized distance from the 
                                // intersecting edge's start point
    boolean is_crease;

    Intersection (Vertex pt, Vertex edge, double t, boolean is_crease) {
        this.pt = pt;
        this.edge = edge;
        this.t = t;
        this.is_crease = is_crease;
    }
}
