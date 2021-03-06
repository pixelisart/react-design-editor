import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { notification } from 'antd';
import { fabric } from 'fabric';
import uuid from 'uuid/v4';
import debounce from 'lodash/debounce';

import CanvasObjects from './canvas/CanvasObjects';

notification.config({
    top: 80,
    duration: 2,
});

const workareaOption = {
    width: 600,
    height: 400,
    workareaWidth: 600,
    workareaHeight: 400,
    lockScalingX: true,
    lockScalingY: true,
    scaleX: 1,
    scaleY: 1,
    backgroundColor: '#fff',
    hasBorders: false,
    hasControls: false,
    selectable: false,
    lockMovementX: true,
    lockMovementY: true,
    hoverCursor: 'default',
    name: '',
    id: 'workarea',
    type: 'image',
    layout: 'fixed', // fixed, responsive, fullscreen
    action: {},
    tooltip: {
        enabled: true,
    },
};

class Canvas extends Component {
    static propsTypes = {
        fabricObjects: PropTypes.object,
        editable: PropTypes.bool,
        width: PropTypes.width,
        height: PropTypes.height,
        tooltip: PropTypes.any,
        zoom: PropTypes.bool,
        propertiesToInclude: PropTypes.array,
        onModified: PropTypes.func,
        onAdd: PropTypes.func,
        onRemove: PropTypes.func,
        onSelect: PropTypes.func,
        onZoom: PropTypes.func,
    }

    static defaultProps = {
        editable: true,
        width: 0,
        height: 0,
        tooltip: null,
        zoom: true,
        propertiesToInclude: ['id', 'name', 'action', 'tooltip', 'layout', 'workareaWidth', 'workareaHeight'],
    }

    handlers = {
        centerObject: (obj, centered) => {
            if (centered) {
                this.canvas.centerObject(obj);
                obj.setCoords();
            } else {
                this.handlers.setByObject(obj, 'left', obj.left - (obj.width / 2));
                this.handlers.setByObject(obj, 'top', obj.top - (obj.height / 2));
            }
        },
        add: (obj, centered = true, loaded = false) => {
            console.log(obj);
            if (this.workarea.layout === 'responsive') {
                if (!this.workarea._element) {
                    return;
                }
            }
            const { editable } = this.props;
            if (obj.type === 'i-text') {
                obj.editable = false;
            } else {
                obj.editable = editable;
            }
            obj.hasControls = editable;
            obj.hasBorders = editable;
            obj.selection = editable;
            obj.lockMovementX = !editable;
            obj.lockMovementY = !editable;
            obj.hoverCursor = !editable ? 'pointer' : 'move';
            if (obj.type === 'image') {
                const newImg = new Image();
                const { src, file, ...otherOption } = obj;
                const defaultOptions = {
                    action: {},
                    tooltip: {
                        enabled: true,
                    },
                };
                if (src) {
                    newImg.onload = () => {
                        const imgObject = new fabric.Image(newImg, {
                            src,
                            ...otherOption,
                            ...defaultOptions,
                        });
                        if (!editable) {
                            imgObject.on('mousedown', this.events.object.mousedown);
                        }
                        this.canvas.add(imgObject);
                        if (!loaded) {
                            this.handlers.centerObject(imgObject, centered);
                        }
                        const { onAdd } = this.props;
                        if (onAdd && !loaded) {
                            onAdd(imgObject);
                        }
                    };
                    newImg.src = src;
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    newImg.onload = () => {
                        const imgObject = new fabric.Image(newImg, {
                            file,
                            ...otherOption,
                            ...defaultOptions,
                        });
                        if (!editable) {
                            imgObject.on('mousedown', this.events.object.mousedown);
                        }
                        this.canvas.add(imgObject);
                        if (!loaded) {
                            this.handlers.centerObject(imgObject, centered);
                        }
                        const { onAdd } = this.props;
                        if (onAdd && !loaded) {
                            onAdd(imgObject);
                        }
                    };
                    newImg.src = e.target.result;
                };
                reader.readAsDataURL(file);
                return;
            }
            const newObject = this.fabricObjects[obj.type].create({ ...obj });
            if (!editable) {
                newObject.on('mousedown', this.events.object.mousedown);
            }
            this.canvas.add(newObject);
            if (obj.type !== 'polygon' && !loaded) {
                this.handlers.centerObject(newObject, centered);
            }
            const { onAdd } = this.props;
            if (onAdd && !loaded) {
                onAdd(newObject);
            }
        },
        remove: () => {
            const activeObject = this.canvas.getActiveObject();
            if (!activeObject) {
                return false;
            }
            if (activeObject.type !== 'activeSelection') {
                this.canvas.discardActiveObject();
                this.canvas.remove(activeObject);
            } else {
                const activeObjects = activeObject._objects;
                this.canvas.discardActiveObject();
                activeObjects.forEach((object) => {
                    this.canvas.remove(object);
                });
            }
            const { onRemove } = this.props;
            if (onRemove) {
                onRemove(activeObject);
            }
        },
        removeById: (id) => {
            const findObject = this.handlers.findById(id);
            if (findObject) {
                this.canvas.discardActiveObject();
                const { onRemove } = this.props;
                if (onRemove) {
                    onRemove(findObject);
                }
                this.canvas.remove(findObject);
            }
        },
        duplicate: () => {
            const { onAdd, propertiesToInclude } = this.props;
            const activeObject = this.canvas.getActiveObject();
            if (!activeObject) {
                return false;
            }
            activeObject.clone((clonedObj) => {
                this.canvas.discardActiveObject();
                clonedObj.set({
                    left: clonedObj.left + 10,
                    top: clonedObj.top + 10,
                    evented: true,
                });
                if (clonedObj.type === 'activeSelection') {
                    clonedObj.canvas = this.canvas;
                    clonedObj.forEachObject((obj) => {
                        obj.set('id', uuid());
                        this.canvas.add(obj);
                    });
                    if (onAdd) {
                        onAdd(clonedObj);
                    }
                    clonedObj.setCoords();
                } else {
                    clonedObj.set('id', uuid());
                    this.canvas.add(clonedObj);
                    if (onAdd) {
                        onAdd(clonedObj);
                    }
                }
                this.canvas.setActiveObject(clonedObj);
                this.canvas.requestRenderAll();
            }, propertiesToInclude);
        },
        duplicateById: (id) => {
            const { onAdd, propertiesToInclude } = this.props;
            const findObject = this.handlers.findById(id);
            if (findObject) {
                findObject.clone((cloned) => {
                    cloned.set({
                        left: cloned.left + 10,
                        top: cloned.top + 10,
                        id: uuid(),
                        evented: true,
                    });
                    this.canvas.add(cloned);
                    if (onAdd) {
                        onAdd(cloned);
                    }
                    this.canvas.setActiveObject(cloned);
                    this.canvas.requestRenderAll();
                }, propertiesToInclude);
            }
        },
        copy: () => {
            this.canvas.getActiveObject().clone((cloned) => {
                this.setState({
                    clipboard: cloned,
                });
            });
        },
        paste: () => {
            const { onAdd } = this.props;
            this.state.clipboard.clone((clonedObj) => {
                this.canvas.discardActiveObject();
                clonedObj.set({
                    left: clonedObj.left + 10,
                    top: clonedObj.top + 10,
                    evented: true,
                });
                if (clonedObj.type === 'activeSelection') {
                    clonedObj.canvas = this.canvas;
                    clonedObj.forEachObject((obj) => {
                        obj.set('id', uuid());
                        this.canvas.add(obj);
                        if (onAdd) {
                            onAdd(obj);
                        }
                    });
                    clonedObj.setCoords();
                } else {
                    clonedObj.set('id', uuid());
                    this.canvas.add(clonedObj);
                    if (onAdd) {
                        onAdd(clonedObj);
                    }
                }
                const newClipboard = Object.assign({}, this.state.clipboard, {
                    top: top + 10,
                    left: left + 10,
                });
                this.setState({
                    clipboard: newClipboard,
                });
                this.canvas.setActiveObject(clonedObj);
                this.canvas.requestRenderAll();
            });
        },
        getActiveObject: () => this.canvas.getActiveObject(),
        getActiveObjects: () => this.canvas.getActiveObjects(),
        setCanvasBackgroundImage: (obj) => {
            const { canvas } = this;
            if (obj.type === 'image') {
                const { src, file } = obj;
                if (src) {
                    fabric.Image.fromURL(src, (img) => {
                        img.set({
                            originX: 'left',
                            originY: 'top',
                        });
                        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                            scaleX: canvas.width / img.width,
                            scaleY: canvas.height / img.height,
                        });
                    });
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    const { result } = e.target;
                    fabric.Image.fromURL(result, (img) => {
                        img.set({
                            originX: 'left',
                            originY: 'top',
                        });
                        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                            scaleX: canvas.width / img.width,
                            scaleY: canvas.height / img.height,
                        });
                    });
                };
                reader.readAsDataURL(file);
                return;
            }
            console.warn('Object type not image');
        },
        set: (key, value) => {
            const activeObject = this.canvas.getActiveObject();
            if (!activeObject) {
                return false;
            }
            activeObject.set(key, value);
            activeObject.setCoords();
            this.canvas.requestRenderAll();
            const { onModified } = this.props;
            if (onModified) {
                onModified(activeObject);
            }
        },
        setObject: (obj) => {
            const activeObject = this.canvas.getActiveObject();
            if (!activeObject) {
                return false;
            }
            Object.keys(obj).forEach((key) => {
                if (obj[key] !== activeObject[key]) {
                    activeObject.set(key, obj[key]);
                    activeObject.setCoords();
                }
            });
            this.canvas.requestRenderAll();
            const { onModified } = this.props;
            if (onModified) {
                onModified(activeObject);
            }
        },
        setByObject: (obj, key, value) => {
            if (!obj) {
                return;
            }
            obj.set(key, value);
            obj.setCoords();
            this.canvas.requestRenderAll();
            const { onModified } = this.props;
            if (onModified) {
                onModified(obj);
            }
        },
        setById: (id, key, value) => {
            const findObject = this.handlers.findById(id);
            this.handlers.setByObject(findObject, key, value);
        },
        loadImage: (obj, src) => {
            if (obj.type === 'image') {
                const newImg = new Image();
                newImg.onload = () => {
                    obj.setElement(newImg);
                    obj.setCoords();
                    this.canvas.renderAll();
                };
                newImg.src = src;
                return;
            }
            fabric.util.loadImage(src, (source) => {
                obj.setPatternFill({
                    source,
                    repeat: 'repeat',
                });
                obj.setCoords();
                this.canvas.renderAll();
            });
        },
        setImage: (obj, src) => {
            if (typeof src === 'string') {
                this.handlers.loadImage(obj, src);
                obj.set('file', null);
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.handlers.loadImage(obj, e.target.result);
                    obj.set('src', null);
                };
                reader.readAsDataURL(src);
            }
        },
        setImageById: (id, source) => {
            const findObject = this.handlers.findById(id);
            this.handlers.setImage(findObject, source);
        },
        setImageByObject: (obj, source) => {
            this.handlers.setImage(obj, source);
        },
        find: obj => this.handlers.findById(obj.id),
        findById: (id) => {
            let findObject;
            const exist = this.canvas.getObjects().some((obj) => {
                if (obj.id === id) {
                    findObject = obj;
                    return true;
                }
                return false;
            });
            if (!exist) {
                console.warn('Not found object by id.');
                return exist;
            }
            return findObject;
        },
        allSelect: () => {
            this.canvas.discardActiveObject();
            const activeSelection = new fabric.ActiveSelection(this.canvas.getObjects().filter((obj) => {
                if (obj.id === 'workarea') {
                    return false;
                }
                if (obj.lock) {
                    return false;
                }
                return true;
            }), {
                canvas: this.canvas,
            });
            this.canvas.setActiveObject(activeSelection);
            this.canvas.requestRenderAll();
        },
        select: (obj) => {
            const findObject = this.handlers.find(obj);
            if (findObject) {
                this.canvas.discardActiveObject();
                this.canvas.setActiveObject(findObject);
                this.canvas.requestRenderAll();
            }
        },
        selectById: (id) => {
            const findObject = this.handlers.findById(id);
            if (findObject) {
                this.canvas.discardActiveObject();
                this.canvas.setActiveObject(findObject);
                this.canvas.requestRenderAll();
            }
        },
        selectByName: (name) => {
            const findObject = this.handlers.findByName(name);
            if (findObject) {
                this.canvas.discardActiveObject();
                this.canvas.setActiveObject(findObject);
                this.canvas.requestRenderAll();
            }
        },
        originScaleToResize: (obj, width, height) => {
            if (obj.id === 'workarea') {
                this.handlers.setById(obj.id, 'workareaWidth', obj.width);
                this.handlers.setById(obj.id, 'workareaHeight', obj.height);
            }
            this.handlers.setById(obj.id, 'scaleX', width / obj.width);
            this.handlers.setById(obj.id, 'scaleY', height / obj.height);
        },
        scaleToResize: (width, height) => {
            const activeObject = this.handlers.getActiveObject();
            const obj = {
                id: activeObject.id,
                scaleX: width / activeObject.width,
                scaleY: height / activeObject.height,
            };
            this.handlers.setObject(obj);
            activeObject.setCoords();
            this.canvas.requestRenderAll();
        },
        importJSON: (json, callback) => {
            if (typeof json === 'string') {
                json = JSON.parse(json);
            }
            let prevLeft;
            let prevTop;
            json.forEach((obj) => {
                if (obj.id === 'workarea') {
                    prevLeft = obj.left;
                    prevTop = obj.top;
                    this.workarea.set(obj);
                    this.canvas.add(this.workarea);
                    this.canvas.centerObject(this.workarea);
                    this.workareaHandlers.setImage(obj.src);
                    this.workarea.setCoords();
                    return;
                }
                const canvasWidth = this.canvas.getWidth();
                const canvasHeight = this.canvas.getHeight();
                const { width, height, scaleX, scaleY, layout, left, top } = this.workarea;
                if (layout === 'fullscreen') {
                    const leftRatio = canvasWidth / (width * scaleX);
                    const topRatio = canvasHeight / (height * scaleY);
                    obj.left *= leftRatio;
                    obj.top *= topRatio;
                } else {
                    const diffLeft = left - prevLeft;
                    const diffTop = top - prevTop;
                    obj.left += diffLeft;
                    obj.top += diffTop;
                }
                this.handlers.add(obj, false, true);
                this.canvas.renderAll();
            });
            this.canvas.setZoom(1);
            if (callback) {
                callback(this.canvas);
            }
        },
        exportJSON: () => this.canvas.toDatalessJSON(this.props.propertiesToInclude),
        exportPNG: () => this.canvas.toDataURL({
            format: 'png',
            quality: 0.8,
        }),
        bringForward: () => {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                this.canvas.bringForward(activeObject);
                const { onModified } = this.props;
                if (onModified) {
                    onModified(activeObject);
                }
            }
        },
        sendBackwards: () => {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                this.canvas.sendBackwards(activeObject);
                const { onModified } = this.props;
                if (onModified) {
                    onModified(activeObject);
                }
            }
        },
    }

    zoomHandlers = {
        zoomToPoint: (point, zoom) => {
            this.canvas.zoomToPoint(point, zoom);
            if (this.props.onZoom) {
                this.props.onZoom(zoom);
            }
        },
        zoomOneToOne: () => {
            const center = this.canvas.getCenter();
            const point = {
                x: center.left,
                y: center.top,
            };
            this.zoomHandlers.zoomToPoint(point, 1);
        },
        zoomToFit: () => {
            let scaleX = this.canvas.getWidth() / this.workarea.width;
            const scaleY = this.canvas.getHeight() / this.workarea.height;
            if (this.workarea.height > this.workarea.width) {
                scaleX = scaleY;
            }
            const center = this.canvas.getCenter();
            const point = {
                x: center.left,
                y: center.top,
            };
            this.zoomHandlers.zoomToPoint(point, scaleX);
        },
        zoomIn: () => {
            let zoomRatio = this.canvas.getZoom();
            zoomRatio += 0.01;
            const center = this.canvas.getCenter();
            const point = {
                x: center.left,
                y: center.top,
            };
            this.zoomHandlers.zoomToPoint(point, zoomRatio);
        },
        zoomOut: () => {
            let zoomRatio = this.canvas.getZoom();
            zoomRatio -= 0.01;
            const center = this.canvas.getCenter();
            const point = {
                x: center.left,
                y: center.top,
            };
            this.zoomHandlers.zoomToPoint(point, zoomRatio);
        },
    }

    tooltipHandlers = {
        showTooltip: debounce((opt) => {
            if (opt.target.tooltip && opt.target.tooltip.enabled) {
                while (this.tooltipRef.current.hasChildNodes()) {
                    this.tooltipRef.current.removeChild(this.tooltipRef.current.firstChild);
                }
                const tooltip = document.createElement('div');
                tooltip.className = 'rde-canvas-tooltip-container';
                tooltip.append(this.props.tooltip || opt.target.name);
                this.tooltipRef.current.appendChild(tooltip);
                this.tooltipRef.current.classList.remove('tooltip-hidden');
                const zoom = this.canvas.getZoom();
                const { clientHeight } = this.tooltipRef.current;
                const { width, height, scaleX, scaleY } = opt.target;
                const { left, top } = opt.target.getBoundingRect();
                const objWidthDiff = (width * scaleX) * zoom;
                const objHeightDiff = (((height * scaleY) * zoom) / 2) - ((clientHeight / 2) * zoom);
                this.tooltipRef.current.style.left = `${left + objWidthDiff}px`;
                this.tooltipRef.current.style.top = `${top + objHeightDiff}px`;
            }
        }, 100),
        hiddenTooltip: debounce((opt) => {
            this.tooltipRef.current.classList.add('tooltip-hidden');
        }, 100),
    }

    workareaHandlers = {
        setLayout: (value) => {
            this.workarea.set('layout', value);
            const { _element } = this.workarea;
            this.canvas.getObjects().forEach((obj) => {
                if (obj.id !== 'workarea') {
                    obj.set({
                        scaleX: 1,
                        scaleY: 1,
                    });
                }
            });
            if (value === 'fixed') {
                if (_element) {
                    this.workarea.set({
                        width: _element.width,
                        height: _element.height,
                        scaleX: this.workarea.workareaWidth / _element.width,
                        scaleY: this.workarea.workareaHeight / _element.height,
                    });
                } else {
                    this.workarea.set({
                        width: this.workarea.workareaWidth,
                        height: this.workarea.workareaHeight,
                    });
                }
                this.canvas.centerObject(this.workarea);
                const center = this.canvas.getCenter();
                const point = {
                    x: center.left,
                    y: center.top,
                };
                this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                this.zoomHandlers.zoomToPoint(point, 1);
                this.canvas.renderAll();
                return;
            }
            if (value === 'responsive') {
                if (_element) {
                    let scaleX = this.canvas.getWidth() / _element.width;
                    const scaleY = this.canvas.getHeight() / _element.height;
                    if (_element.height > _element.width) {
                        scaleX = scaleY;
                    }
                    const center = this.canvas.getCenter();
                    const point = {
                        x: center.left,
                        y: center.top,
                    };
                    this.workarea.set({
                        scaleX: 1,
                        scaleY: 1,
                    });
                    this.zoomHandlers.zoomToPoint(point, scaleX);
                } else {
                    this.workarea.set({
                        width: 0,
                        height: 0,
                    });
                }
                this.canvas.centerObject(this.workarea);
                this.canvas.renderAll();
                return;
            }
            if (_element) {
                const scaleX = this.canvas.getWidth() / _element.width;
                const scaleY = this.canvas.getHeight() / _element.height;
                this.workarea.set({
                    width: _element.width,
                    height: _element.height,
                    scaleX,
                    scaleY,
                    originScaleX: scaleX,
                    originScaleY: scaleY,
                });
            } else {
                this.workarea.set({
                    width: this.canvas.getWidth(),
                    height: this.canvas.getHeight(),
                });
            }
            const center = this.canvas.getCenter();
            const point = {
                x: center.left,
                y: center.top,
            };
            this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            this.zoomHandlers.zoomToPoint(point, 1);
            this.workarea.set({
                left: 0,
                top: 0,
            });
            this.workarea.setCoords();
            this.canvas.renderAll();
        },
        setResponsiveImage: (source) => {
            const { canvas, workarea, zoomHandlers } = this;
            if (typeof source === 'string') {
                fabric.Image.fromURL(source, (img) => {
                    let scaleX = canvas.getWidth() / img.width;
                    const scaleY = canvas.getHeight() / img.height;
                    if (img.height > img.width) {
                        scaleX = scaleY;
                    }
                    img.set({
                        originX: 'left',
                        originY: 'top',
                    });
                    this.workarea.set({
                        ...img,
                        src: source,
                        selectable: false,
                    });
                    canvas.centerObject(workarea);
                    const center = canvas.getCenter();
                    const point = {
                        x: center.left,
                        y: center.top,
                    };
                    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                    zoomHandlers.zoomToPoint(point, scaleX);
                    canvas.renderAll();
                });
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const src = e.target.result;
                fabric.Image.fromURL(src, (img) => {
                    let scaleX = canvas.getWidth() / img.width;
                    const scaleY = canvas.getHeight() / img.height;
                    if (img.height > img.width) {
                        scaleX = scaleY;
                    }
                    img.set({
                        originX: 'left',
                        originY: 'top',
                    });
                    workarea.set({
                        ...img,
                        file: source,
                        selectable: false,
                    });
                    canvas.centerObject(workarea);
                    const center = canvas.getCenter();
                    const point = {
                        x: center.left,
                        y: center.top,
                    };
                    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                    zoomHandlers.zoomToPoint(point, scaleX);
                    canvas.renderAll();
                });
            };
            reader.readAsDataURL(source);
        },
        setImage: (source) => {
            if (!source) {
                return;
            }
            const { canvas, workarea, zoomHandlers, workareaHandlers } = this;
            if (workarea.layout === 'responsive') {
                workareaHandlers.setResponsiveImage(source);
                return;
            }
            if (typeof source === 'string') {
                fabric.Image.fromURL(source, (img) => {
                    let width = canvas.getWidth();
                    let height = canvas.getHeight();
                    if (workarea.layout === 'fixed') {
                        width = workarea.width * workarea.scaleX;
                        height = workarea.height * workarea.scaleY;
                    }
                    img.set({
                        originX: 'left',
                        originY: 'top',
                        originScaleX: width / img.width,
                        originScaleY: height / img.height,
                        scaleX: width / img.width,
                        scaleY: height / img.height,
                    });
                    workarea.set({
                        ...img,
                        src: source,
                        selectable: false,
                    });
                    canvas.centerObject(workarea);
                    const center = canvas.getCenter();
                    const point = {
                        x: center.left,
                        y: center.top,
                    };
                    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                    zoomHandlers.zoomToPoint(point, 1);
                    canvas.renderAll();
                });
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const src = e.target.result;
                fabric.Image.fromURL(src, (img) => {
                    let width = canvas.getWidth();
                    let height = canvas.getHeight();
                    if (workarea.layout === 'fixed') {
                        width = workarea.width * workarea.scaleX;
                        height = workarea.height * workarea.scaleY;
                    }
                    img.set({
                        originX: 'left',
                        originY: 'top',
                        originScaleX: width / img.width,
                        originScaleY: height / img.height,
                        scaleX: width / img.width,
                        scaleY: height / img.height,
                    });
                    workarea.set({
                        ...img,
                        file: source,
                        selectable: false,
                    });
                    canvas.centerObject(workarea);
                    const center = canvas.getCenter();
                    const point = {
                        x: center.left,
                        y: center.top,
                    };
                    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                    zoomHandlers.zoomToPoint(point, 1);
                    canvas.renderAll();
                });
            };
            reader.readAsDataURL(source);
        },
    }

    drawingHandlers = {
        initDraw: () => {
            this.polygonMode = true;
            this.pointArray = [];
            this.lineArray = [];
            this.activeLine = null;
            this.activeShape = null;
        },
        finishDraw: () => {
            this.polygonMode = false;
            this.pointArray.forEach((point) => {
                this.canvas.remove(point);
            });
            this.lineArray.forEach((line) => {
                this.canvas.remove(line);
            });
            this.canvas.remove(this.activeLine);
            this.canvas.remove(this.activeShape);
            this.pointArray = [];
            this.lineArray = [];
            this.activeLine = null;
            this.activeShape = null;
        },
        addPoint: (obj) => {
            obj.points.forEach((point, index) => {
                const circle = new fabric.Circle({
                    id: uuid(),
                    radius: 5,
                    fill: '#ffffff',
                    stroke: '#333333',
                    strokeWidth: 0.5,
                    selectable: true,
                    hasBorders: false,
                    hasControls: false,
                    originX: 'center',
                    originY: 'center',
                    hoverCursor: 'pointer',
                    polygon: obj.id,
                    name: index,
                });
                circle.setPositionByOrigin(new fabric.Point(point.x, point.y), 'left', 'top');
                this.canvas.add(circle);
            });
        },
        polygon: {
            addPoint: (opt) => {
                const id = uuid();
                const { e, absolutePointer } = opt;
                const { x, y } = absolutePointer;
                const circle = new fabric.Circle({
                    id,
                    radius: 5,
                    fill: '#ffffff',
                    stroke: '#333333',
                    strokeWidth: 0.5,
                    left: x,
                    top: y,
                    selectable: false,
                    hasBorders: false,
                    hasControls: false,
                    originX: 'center',
                    originY: 'center',
                    hoverCursor: 'pointer',
                });
                if (!this.pointArray.length) {
                    circle.set({
                        fill: 'red',
                    });
                }
                const points = [x, y, x, y];
                const line = new fabric.Line(points, {
                    strokeWidth: 2,
                    fill: '#999999',
                    stroke: '#999999',
                    class: 'line',
                    originX: 'center',
                    originY: 'center',
                    selectable: false,
                    hasBorders: false,
                    hasControls: false,
                    evented: false,
                });
                if (this.activeShape) {
                    const position = this.canvas.getPointer(e);
                    const activeShapePoints = this.activeShape.get('points');
                    activeShapePoints.push({
                        x: position.x,
                        y: position.y,
                    });
                    const polygon = new fabric.Polygon(activeShapePoints, {
                        stroke: '#333333',
                        strokeWidth: 1,
                        fill: '#cccccc',
                        opacity: 0.1,
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        evented: false,
                    });
                    this.canvas.remove(this.activeShape);
                    this.canvas.add(polygon);
                    this.activeShape = polygon;
                    this.canvas.renderAll();
                } else {
                    const polyPoint = [{ x, y }];
                    const polygon = new fabric.Polygon(polyPoint, {
                        stroke: '#333333',
                        strokeWidth: 1,
                        fill: '#cccccc',
                        opacity: 0.1,
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        evented: false,
                    });
                    this.activeShape = polygon;
                    this.canvas.add(polygon);
                }
                this.activeLine = line;
                this.pointArray.push(circle);
                this.lineArray.push(line);
                this.canvas.add(line);
                this.canvas.add(circle);
                this.canvas.selection = false;
            },
            generatePolygon: (pointArray) => {
                const points = [];
                const id = uuid();
                pointArray.forEach((point) => {
                    points.push({
                        x: point.left,
                        y: point.top,
                    });
                    this.canvas.remove(point);
                });
                this.lineArray.forEach((line) => {
                    this.canvas.remove(line);
                });
                this.canvas.remove(this.activeShape).remove(this.activeLine);
                const option = {
                    id,
                    points,
                    type: 'polygon',
                    stroke: 'rgba(0, 0, 0, 1)',
                    strokeWidth: 3,
                    strokeDashArray: [10, 5],
                    fill: 'rgba(255, 255, 255, 0)',
                    opacity: 1,
                };
                this.handlers.add(option, false);
                this.activeLine = null;
                this.activeShape = null;
                this.polygonMode = false;
                this.canvas.selection = true;
            },
        },
        line: {

        },
    }

    events = {
        object: {
            mousedown: (opt) => {
                const { target } = opt;
                if (target && target.action.enabled) {
                    const { action } = target;
                    if (action.type === 'dashboard') {
                        console.log(opt.target);
                    } else if (action.type === 'url') {
                        if (action.state === 'current') {
                            document.location.href = action.url;
                            return;
                        }
                        window.open(action.url);
                    }
                }
            },
            // mouseover: (opt) => {
            //     if (opt.target && opt.target.tooltip.enabled) {
            //         while (this.tooltipRef.current.hasChildNodes()) {
            //             this.tooltipRef.current.removeChild(this.tooltipRef.current.firstChild);
            //         }
            //         const tooltip = document.createElement('div');
            //         tooltip.className = 'rde-canvas-tooltip-container';
            //         tooltip.append(this.props.tooltip || opt.target.name);
            //         console.log(tooltip);
            //         console.log(opt);
            //         this.tooltipRef.current.appendChild(tooltip);
            //         this.tooltipRef.current.classList.remove('tooltip-hidden');
            //         const { left, top } = this.handlers.getAbsoluteCoords(opt.target);
            //         const { width, height } = opt.target;
            //         this.tooltipRef.current.style.left = `${left + width}px`;
            //         this.tooltipRef.current.style.top = `${top + (height / 2)}px`;
            //     }
            // },
            // mouseout: (opt) => {
            //     if (opt.target && opt.target.tooltip.enabled) {
            //         console.log(opt);
            //         this.tooltipRef.current.classList.add('tooltip-hidden');
            //     }
            // },
        },
        modified: (opt) => {
            const { onModified } = this.props;
            if (onModified) {
                const { target } = opt;
                if (!target) {
                    return;
                }
                onModified(opt.target);
            }
        },
        moving: (e) => {
            const activeObject = this.handlers.getActiveObject();
            if (!activeObject) {
                return false;
            }
            if (e.code === 'ArrowUp') {
                activeObject.set('top', activeObject.top - 2);
                activeObject.setCoords();
                this.canvas.renderAll();
            } else if (e.code === 'ArrowDown') {
                activeObject.set('top', activeObject.top + 2);
                activeObject.setCoords();
                this.canvas.renderAll();
            } else if (e.code === 'ArrowLeft') {
                activeObject.set('left', activeObject.left - 2);
                activeObject.setCoords();
                this.canvas.renderAll();
            } else if (e.code === 'ArrowRight') {
                activeObject.set('left', activeObject.left + 2);
                activeObject.setCoords();
                this.canvas.renderAll();
            }
            if (this.props.onModified) {
                this.props.onModified(activeObject);
            }
        },
        mousewheel: (opt) => {
            const { zoom, onZoom } = this.props;
            if (zoom) {
                const delta = opt.e.deltaY;
                let zoomRatio = this.canvas.getZoom();
                if (delta > 0) {
                    zoomRatio -= 0.01;
                } else {
                    zoomRatio += 0.01;
                }
                this.canvas.zoomToPoint(new fabric.Point(this.canvas.width / 2, this.canvas.height / 2), zoomRatio);
                opt.e.preventDefault();
                opt.e.stopPropagation();
                if (onZoom) {
                    onZoom(zoomRatio);
                }
            }
        },
        mousedown: (opt) => {
            if (this.polygonMode) {
                if (opt.target && this.pointArray.length && opt.target.id === this.pointArray[0].id) {
                    this.drawingHandlers.polygon.generatePolygon(this.pointArray);
                } else {
                    this.drawingHandlers.polygon.addPoint(opt);
                }
            }
        },
        mousemove: (opt) => {
            if (!this.props.editable) {
                if (opt.target && opt.target.id !== 'workarea') {
                    this.tooltipHandlers.showTooltip(opt);
                } else {
                    this.tooltipHandlers.hiddenTooltip(opt);
                }
            }
            if (this.activeLine && this.activeLine.class === 'line') {
                const pointer = this.canvas.getPointer(opt.e);
                this.activeLine.set({ x2: pointer.x, y2: pointer.y });
                const points = this.activeShape.get('points');
                points[this.pointArray.length] = {
                    x: pointer.x,
                    y: pointer.y,
                };
                this.activeShape.set({
                    points,
                });
                this.canvas.renderAll();
            }
            this.canvas.renderAll();
        },
        selection: (opt) => {
            const { onSelect } = this.props;
            if (onSelect) {
                onSelect(opt);
            }
        },
        resize: (currentWidth, currentHeight, nextWidth, nextHeight) => {
            this.currentWidth = currentWidth;
            this.canvas.setWidth(nextWidth).setHeight(nextHeight);
            if (!this.workarea) {
                return;
            }
            if (this.workarea.layout === 'fixed') {
                const diffWidth = (nextWidth / 2) - (currentWidth / 2);
                const diffHeight = (nextHeight / 2) - (currentHeight / 2);
                this.canvas.centerObject(this.workarea);
                this.workarea.setCoords();
                this.canvas.getObjects().forEach((obj, index) => {
                    if (index !== 0) {
                        obj.set('left', obj.left + diffWidth);
                        obj.set('top', obj.top + diffHeight);
                        obj.setCoords();
                    }
                });
                this.canvas.renderAll();
                return;
            }
            let scaleX = nextWidth / this.workarea.width;
            const scaleY = nextHeight / this.workarea.height;
            if (this.workarea.layout === 'responsive') {
                if (this.workarea.height > this.workarea.width) {
                    scaleX = scaleY;
                }
                const diffWidth = (nextWidth / 2) - (currentWidth / 2);
                const diffHeight = (nextHeight / 2) - (currentHeight / 2);
                const deltaPoint = new fabric.Point(diffWidth, diffHeight);
                this.deltaPoint = deltaPoint;
                this.canvas.relativePan(deltaPoint);
                const center = this.canvas.getCenter();
                const point = {
                    x: center.left,
                    y: center.top,
                };
                this.zoomHandlers.zoomToPoint(point, scaleX);
                this.canvas.renderAll();
                return;
            }
            const diffScaleX = nextWidth / (this.workarea.width * this.workarea.scaleX);
            const diffScaleY = nextHeight / (this.workarea.height * this.workarea.scaleY);
            const originDiffScaleX = nextWidth / (this.workarea.width * this.workarea.originScaleX);
            const originDiffScaleY = nextHeight / (this.workarea.height * this.workarea.originScaleY);
            if (!this.workarea._element) {
                this.workarea.set({
                    scaleX,
                    scaleY,
                });
                this.canvas.getObjects().forEach((obj, index) => {
                    if (index !== 0) {
                        obj.set({
                            scaleX,
                            scaleY,
                            left: obj.left * diffScaleX,
                            top: obj.top * diffScaleY,
                        });
                        obj.setCoords();
                    }
                });
            } else {
                this.workarea.set({
                    scaleX,
                    scaleY,
                });
                this.canvas.getObjects().forEach((obj, index) => {
                    if (index !== 0) {
                        obj.set({
                            scaleX: originDiffScaleX,
                            scaleY: originDiffScaleY,
                            left: obj.left * diffScaleX,
                            top: obj.top * diffScaleY,
                        });
                        obj.setCoords();
                    }
                });
            }
            // this.canvas.getObjects().forEach((obj, index) => {
            //     if (index !== 0) {
            //         const isLeft = obj.left < nextWidth / 2;
            //         const isTop = obj.top < nextHeight / 2;
            //         obj.set({
            //             left: isLeft ? obj.left : obj.left + (nextWidth - currentWidth),
            //             top: isTop ? obj.top : obj.top + (nextHeight - currentHeight),
            //         });
            //         obj.setCoords();
            //     }
            // });
            this.canvas.renderAll();
        },
        paste: (e) => {
            if (this.canvas.wrapperEl !== document.activeElement) {
                return false;
            }
            e = e || window.event;
            if (e.preventDefault) {
                e.preventDefault();
            }
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            const clipboardData = e.clipboardData || window.clipboardData;
            if (clipboardData.types.length) {
                clipboardData.types.forEach((clipboardType) => {
                    if (clipboardType === 'text/plain') {
                        const textPlain = clipboardData.getData('text/plain');
                        const item = {
                            id: uuid(),
                            type: 'textbox',
                            text: textPlain,
                        };
                        this.handlers.add(item, true);
                    } else if (clipboardType === 'text/html') {
                        // Todo ...
                        // const textHtml = clipboardData.getData('text/html');
                        // console.log(textHtml);
                    } else if (clipboardType === 'Files') {
                        Array.from(clipboardData.files).forEach((file) => {
                            const { type } = file;
                            if (type === 'image/png' || type === 'image/jpeg' || type === 'image/jpg') {
                                const item = {
                                    id: uuid(),
                                    type: 'image',
                                    file,
                                };
                                this.handlers.add(item, true);
                            } else {
                                notification.warn({
                                    message: 'Not supported file type',
                                });
                            }
                        });
                    }
                });
            }
            return false;
        },
        keydown: (e) => {
            if (this.canvas.wrapperEl !== document.activeElement) {
                return false;
            }
            if (e.code === 'Delete') {
                this.handlers.remove();
            } else if (e.code.includes('Arrow')) {
                this.events.moving(e);
            } else if (e.ctrlKey && e.code === 'KeyA') {
                e.preventDefault();
                this.handlers.allSelect();
            } else if (e.code === 'Escape') {
                if (this.polygonMode) {
                    this.drawingHandlers.finishDraw();
                }
            }
        },
    }

    constructor(props) {
        super(props);
        this.fabricObjects = CanvasObjects(props.fabricObjects);
        this.container = React.createRef();
        this.tooltipRef = React.createRef();
    }

    state = {
        id: uuid(),
        clipboard: null,
    }

    componentDidMount() {
        const { id } = this.state;
        const { editable, width, height } = this.props;
        this.canvas = new fabric.Canvas(`canvas_${id}`, {
            preserveObjectStacking: true,
            width,
            height,
            backgroundColor: '#f3f3f3',
            selection: editable,
        });
        this.workarea = new fabric.Image(null, {
            ...workareaOption,
        });
        this.canvas.add(this.workarea);
        this.canvas.centerObject(this.workarea);
        const { modified, mousewheel, mousedown, mousemove, selection } = this.events;
        if (editable) {
            this.canvas.on({
                'object:modified': modified,
                'mouse:wheel': mousewheel,
                'mouse:down': mousedown,
                'mouse:move': mousemove,
                'selection:cleared': selection,
                'selection:created': selection,
                'selection:updated': selection,
            });
            this.attachEventListener();
        } else {
            this.canvas.on({
                'mouse:move': mousemove,
            });
        }
    }

    componentDidUpdate(prevProps, prevState) {
        const { width: currentWidth, height: currentHeight } = this.props;
        const { width: prevWidth, height: prevHeight } = prevProps;
        if (currentWidth !== prevWidth || currentHeight !== prevHeight) {
            this.events.resize(prevWidth, prevHeight, currentWidth, currentHeight);
        }
    }

    componentWillUnmount() {
        this.detachEventListener();
    }

    attachEventListener = () => {
        // if add canvas wrapper element event, tabIndex = 1000;
        this.canvas.wrapperEl.tabIndex = 1000;
        document.addEventListener('keydown', this.events.keydown, false);
        document.addEventListener('paste', this.events.paste, false);
    }

    detachEventListener = () => {
        document.removeEventListener('keydown', this.events.keydown);
        document.removeEventListener('paste', this.events.paste);
    }

    render() {
        const { editable } = this.props;
        const { id } = this.state;
        const tooltipRender = editable ? null : (
            <div
                ref={this.tooltipRef}
                id={`tooltip_${id}`}
                className="rde-canvas-tooltip tooltip-hidden"
            />
        );
        return (
            <div
                ref={this.container}
                id="rde-canvas"
                className="rde-canvas"
            >
                <canvas id={`canvas_${id}`} />
                {tooltipRender}
            </div>
        );
    }
}

export default Canvas;
