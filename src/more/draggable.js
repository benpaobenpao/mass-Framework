$.define("draggable","event,css,attr",function(){
    var  $doc = $(document), $dragger//一些全局的东西
    function preventDefault (e) {
        e.preventDefault();
    }

    function Draggable( $el, opts ){
        $el.data("drag_opts",opts);
        $el.attr('draggable', 'true');
        $el.on('dragstart', preventDefault);//处理原生的dragstart事件
        if (!opts.noCursor) {
            if (opts.handle) {//添加表示能拖放的样式
                $el.find(opts.handle).css('cursor', 'move');
            } else {
                $el.css('cursor', 'move');
            }
        }
        var position = $el.position();
        $el.css({
            'top': position.top,
            'left': position.left,
            'position': 'absolute'
        });
        //是否锁定它只能往某一个方向活动
        this.lockX = !!opts.lockX
        this.lockY = !!opts.lockY;
        //默认false。当值为true时，让拖动元素在拖动后回到原来的位置

        this.rewind = !!opts.rewind;
        //默认false。当值为true时，会生成一个与拖动元素相仿的影子元素，拖动时只拖动影子元素，以减轻内存消耗。
        this.ghosting = !!opts.ghosting;
        this.target = $el;
        this.click = !!opts.click;//阻止浏览器默认行为
        //手柄的类名，当设置了此参数后，只允许用手柄拖动元素。
        this.handle = typeof opts.handle == "string" ? opts.handle : null;
        //默认true, 允许滚动条随拖动元素移动。
        this.scroll = typeof opts.scroll == "boolean" ? opts.scroll : true;
        //监视鼠标的位置，一旦超过出拖动块就立即停止
        this.strict  = typeof opts.strict  == "boolean" ? opts.strict  : true;
        if(this.scroll){
            this.scrollSensitivity = opts.scrollSensitivity >= 0 ?  opts.scrollSensitivity : 20;
            this.scrollSpeed = opts.scrollSensitivity >= 0 ?  opts.scrollSpeed : 20;
            this.scrollParent = $el.scrollParent()[0]
            this.overflowOffset = $el.scrollParent().offset();
        }
        "dragstart dragover dragend".replace($.rword, function(event){
            var fn = opts[event];
            if(typeof fn == "function"){
                $el.on(event + ".mass_ui", fn)
            }
        });

        $el.on('mousedown',this.handle , dragstart);

        var limit = opts.containment;
        if(limit){
            //修正其可活动的范围，如果传入的坐标
            if($.type(limit, "Array") && limit.length ==4){//[x1,y1,x2,y2] left,top,right,bottom
                this.limit = limit;
            }else{
                if(limit == 'parent')
                    limit = $el[0].parentNode;
                if(limit == 'document' || limit == 'window') {
                    this.limit = [  limit == 'document' ? 0 : $(window).scrollLeft() , limit == 'document' ? 0 : $(window).scrollTop()]
                    this.limit[2]  = this.limit[0] + $(limit == 'document'? document : window).width()
                    this.limit[3]  = this.limit[1] + $(limit == 'document'? document : window).height()
                }
                if(!(/^(document|window|parent)$/).test(limit) && !this.limit) {
                    var c = $(limit);
                    if(c[0]){
                        var offset = c.offset();
                        this.limit = [ offset.left + parseFloat(c.css("borderLeftWidth")),offset.top + parseFloat(c.css("borderTopWidth")) ]
                        this.limit[2]  = this.limit[0] + c.innerWidth()
                        this.limit[3]  = this.limit[1] + c.innerHeight()
                    }
                }
            }
            if(this.limit){//减少拖动块的面积
                this.limit[2]  = this.limit[2] - $el.outerWidth();
                this.limit[3]  = this.limit[3] - $el.outerHeight();
            }
        }

    }

    $.fn.draggable = function( opts ){
        opts = opts || {};
        for(var i =0 ; i < this.length; i++){
            if(this[i] && this[i].nodeType === 1){
                var $el = $(this[i])
                var dd = $el.data("_mass_draggable")
                if(! dd  ){
                    dd = new Draggable( $el, opts );
                    $el.data( "_mass_draggable" , dd );
                }
            }
        }
        return this;
    }

    function dispatch( event, dragger, dd , type ){
        event.type = type;
        event.namespace = "mass_ui";
        event.namespace_re = new RegExp("(^|\\.)" + "mass_ui" + "(\\.|$)");
        dragger.fire( event, dd );
    }

    function patch( event, dragger, dd, callback){
        if( dd.multi && $.isArrayLike(dd.multi) ){
            for(var j = 0, node; node = dd.multi[j]; j++){
                if( node != dragger[0] ){//防止环引用，导致死循环
                    $dragger = $(node)
                    callback( event, node, j );
                }
            }
            $dragger = dragger;
        }
    }

    function dragstart(event, el, lock ){
        el = el || event.currentTarget;//如果是多点拖动，el, i是存在的
        var dragger = $(el);//每次只允许运行一个实例
        var dd = dragger.data("_mass_draggable");
        if(dd.ghosting){
            var ghosting = el.cloneNode(false);
            el.parentNode.insertBefore( ghosting,el.nextSibling );
            if( dd.handle){
                dragger.find(dd.handle).appendTo(ghosting)
            }
            if($.support.cssOpacity){
                ghosting.style.opacity = 0.5;
            }else{
                ghosting.style.filter = "alpha(opacity=50)";
            }
            dragger = $(ghosting).addClass("mass_ghosting");
        };
        var offset = dragger.offset();
        dragger.addClass("mass_dragging");
        dd.startX = event.pageX;
        dd.startY = event.pageY;
        dd.originalX = offset.left;
        dd.originalY = offset.top;
        if(dragger[0].setCapture){ //设置鼠标捕获
            dragger[0].setCapture();
        }else{ //阻止默认动作
            event.preventDefault();
        };
        $dragger = dragger;//暴露到外围作用域，供dragover与dragend与dragstop调用
        dispatch(  event, dragger, dd,  "dragstart" );
        //开始批处理dragstart
        if( ! lock ){
            patch( event, dragger, dd, dragstart );
            //防止隔空拖动，为了性能起见，150ms才检测一下
            if(dd.strict){
                dd.checkID = setInterval(dragstop, 150);
            }
        }
    }

    function dragover(event, el, lock ){
        if($dragger){
            var dd = $dragger.data("_mass_draggable");
            dd.event  = event;//这个供dragstop API调用
            //当前元素移动了多少距离
            dd.deltaX = event.pageX - dd.startX;
            dd.deltaY = event.pageY - dd.startY;
            //现在的坐标
            dd.offsetX = dd.deltaX + dd.originalX  ;
            dd.offsetY = dd.deltaY + dd.originalY  ;
            dd.dragging = true;//这个用于dragend API
            if(!dd.lockX){//如果没有锁定X轴left,top,right,bottom
                var left = dd.limit ?  Math.min( dd.limit[2], Math.max( dd.limit[0], dd.offsetX )) : dd.offsetX
                $dragger[0].style.left = left+"px"
            }
            if(!dd.lockY){//如果没有锁定Y轴
                var top =  dd.limit ?   Math.min( dd.limit[3], Math.max( dd.limit[1], dd.offsetY ) ) : dd.offsetY;
                $dragger[0].style.top = top+"px"
            }

            if(dd.scroll){
                if(dd.scrollParent != document && dd.scrollParent.tagName != 'HTML') {
                    if(!dd.lockX) {
                        if((dd.overflowOffset.top + dd.scrollParent.offsetHeight) - event.pageY < dd.scrollSensitivity)
                            dd.scrollParent.scrollTop = dd.scrollParent.scrollTop + dd.scrollSpeed;
                        else if(event.pageY - dd.overflowOffset.top < dd.scrollSensitivity)
                            dd.scrollParent.scrollTop = dd.scrollParent.scrollTop - dd.scrollSpeed;
                    }

                    if(!dd.lockY) {
                        if((dd.overflowOffset.left + dd.scrollParent.offsetWidth) - event.pageX < dd.scrollSensitivity)
                            dd.scrollParent.scrollLeft = dd.scrollParent.scrollLeft + dd.scrollSpeed;
                        else if(event.pageX - dd.overflowOffset.left < dd.scrollSensitivity)
                            dd.scrollParent.scrollLeft =  dd.scrollParent.scrollLeft - dd.scrollSpeed;
                    }

                } else {
                    var docTop = $doc.scrollTop(), docLeft = $doc.scrollTop();
                    if(!dd.lockX) {
                        if(event.pageY - docTop < dd.scrollSensitivity)
                            $doc.scrollTop( docTop - dd.scrollSpeed);
                        else if( $(window).height() -  event.pageY + docTop  < dd.scrollSensitivity)
                            $doc.scrollTop( docTop + dd.scrollSpeed);
                    }

                    if(!dd.lockY) {
                        if(event.pageX - docLeft < dd.scrollSensitivity)
                            $doc.scrollLeft( docLeft - dd.scrollSpeed);
                        else if($(window).width() -  event.pageX + docLeft  < dd.scrollSensitivity)
                            $doc.scrollLeft( docLeft + dd.scrollSpeed);
                    }

                }
            }

            dispatch( event, $dragger, dd, "dragover");
            //开始批处理dragover
            if( !lock ){
                patch( event, $dragger, dd, dragover );
            }
        }
    }

    function dragend( event, el, lock ){
        if($dragger){
            var dragger = $dragger
            var dd = $dragger.data("_mass_draggable");
            if(dd.checkID){
                clearInterval(dd.checkID);
                delete dd.event;
                delete dd.checkID;
            }
            if(dragger[0].releaseCapture){
                dragger[0].releaseCapture();
            }
            dragger.removeClass("mass_dragging");
            dd.ghosting && dragger.remove();
            dispatch( event, dragger, dd,  "dragend" );
            if(!lock){
                  patch( event, $dragger, dd, dragend );
            }
            if(dd.rewind || dd.ghosting){
                dd.target.fx( 500,{
                    left:  dd.rewind ? dd.originalX: dd.offsetX,
                    top:   dd.rewind ? dd.originalY: dd.offsetY
                });
            }

            if(dd.dragging && dd.click === false){//阻止"非刻意"的点击事件,因为我们每点击页面,都是依次触发mousedown mouseup click事件
                $.event.fireType = "click";
                setTimeout(function(){
                    delete $.event.fireType
                }, 30)
                dd.dragging = false;
            }
            if(!lock){
              
                $dragger = null;
            }
           
        }
    }

    function dragstop(){
        if( $dragger ){
            var dd = $dragger.data("_mass_draggable");
            if(dd.event){
                var offset = $dragger.offset(),
                left = offset.left,
                top = offset.top,
                event = dd.event,
                pageX = event.pageX,
                pageY = event.pageY
                if( pageX <  left || pageY < top || pageX > left+$dragger[0].offsetWidth ||  pageY > top+$dragger[0].offsetHeight ){
                    dragend( event )
                }
            }
        }
    }

    $doc.on({
        "mouseup.mass_ui blur.mass_ui": dragend,
        "mousemove.mass_ui":  dragover,
        "selectstart.mass_ui": function(e){
            if( $dragger ){
                preventDefault(e);
                if (window.getSelection) {
                    window.getSelection().removeAllRanges();
                } else if (document.selection) {
                    document.selection.clear();
                }
            }
        }
    });

})