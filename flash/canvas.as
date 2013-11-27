onClipEvent (load) {
    _root.init();
    _xscale = 100;
    _yscale = 100;
    _x = 0;
    _y = 0;
    rescale_idx = 0;
}

onClipEvent (enterFrame) 
{
    if (rescale_idx > 0) 
    {
        _xscale += scale_delta;
        _yscale += scale_delta;
        _x += x_delta;
        _y += y_delta;
        --rescale_idx;
    }
}
