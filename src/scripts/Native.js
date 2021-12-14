import Core from './Core';
import smoothscroll from 'smoothscroll-polyfill';
import { getParents, queryClosestParent } from './utils/html';
import { getTranslate } from './utils/transform';
import { lerp } from './utils/maths';

export default class extends Core {
    constructor(options = {}) {
        super(options);

        if (this.resetNativeScroll) {
            if (history.scrollRestoration) {
                history.scrollRestoration = 'manual';
            }
            window.scrollTo(0, 0);
        }

        window.addEventListener('scroll', this.checkScroll, false);

        if (window.smoothscrollPolyfill === undefined) {
            window.smoothscrollPolyfill = smoothscroll;
            window.smoothscrollPolyfill.polyfill();
        }
    }

    init() {
        this.instance.scroll.y = window.pageYOffset;

        this.parallaxElements = {};
        this.sections = {};

        this.addSections();
        this.addElements();
        this.detectElements();

        super.init();
    }

    checkScroll() {
        super.checkScroll();

        if (this.getDirection) {
            this.addDirection();
        }

        if (this.getSpeed) {
            this.addSpeed();
            this.speedTs = Date.now();
        }

        this.instance.scroll.y = window.pageYOffset;

        if (Object.entries(this.els).length) {
            if (!this.hasScrollTicking) {
                requestAnimationFrame(() => {
                    this.detectElements();
                    this.transformElements();
                });
                this.hasScrollTicking = true;
            }
        }
    }

    raf() {}

    addDirection() {
        if (window.pageYOffset > this.instance.scroll.y) {
            if (this.instance.direction !== 'down') {
                this.instance.direction = 'down';
            }
        } else if (window.pageYOffset < this.instance.scroll.y) {
            if (this.instance.direction !== 'up') {
                this.instance.direction = 'up';
            }
        }
    }

    addSpeed() {
        if (window.pageYOffset != this.instance.scroll.y) {
            this.instance.speed =
                (window.pageYOffset - this.instance.scroll.y) /
                Math.max(1, Date.now() - this.speedTs);
        } else {
            this.instance.speed = 0;
        }
    }

    resize() {
        if (Object.entries(this.els).length) {
            this.windowHeight = window.innerHeight;
            this.updateElements();
        }
    }

    addSections() {
        this.sections = {};

        let sections = this.el.querySelectorAll(`[data-${this.name}-section]`);
        if (sections.length === 0) {
            sections = [this.el];
        }

        sections.forEach((section, index) => {
            let id =
                typeof section.dataset[this.name + 'Id'] === 'string'
                    ? section.dataset[this.name + 'Id']
                    : 'section' + index;
            const sectionBCR = section.getBoundingClientRect();
            let offset = {
                x: sectionBCR.left - window.innerWidth * 1.5 - getTranslate(section).x,
                y: sectionBCR.top - window.innerHeight * 1.5 - getTranslate(section).y
            };
            let limit = {
                x: offset.x + sectionBCR.width + window.innerWidth * 2,
                y: offset.y + sectionBCR.height + window.innerHeight * 2
            };
            let persistent = typeof section.dataset[this.name + 'Persistent'] === 'string';
            section.setAttribute('data-scroll-section-id', id);

            const mappedSection = {
                el: section,
                offset: offset,
                limit: limit,
                inView: false,
                persistent: persistent,
                id: id
            };

            this.sections[id] = mappedSection;
        });
    }

    addElements() {
        this.els = {};
        this.parallaxElements = {};

        // this.sections.forEach((section, y) => {
        const els = this.el.querySelectorAll(`[data-${this.name}]`);

        els.forEach((el, index) => {
            // Try and find the target's parent section
            const targetParents = getParents(el);
            let section = Object.entries(this.sections)
                .map(([key, section]) => section)
                .find((section) => targetParents.includes(section.el));

            let cl = el.dataset[this.name + 'Class'] || this.class;
            let id =
                typeof el.dataset[this.name + 'Id'] === 'string'
                    ? el.dataset[this.name + 'Id']
                    : 'el' + index;
            let top;
            let left;
            let repeat = el.dataset[this.name + 'Repeat'];
            let call = el.dataset[this.name + 'Call'];
            let position = el.dataset[this.name + 'Position'];
            let delay = el.dataset[this.name + 'Delay'];
            let direction = el.dataset[this.name + 'Direction'];
            let sticky = typeof el.dataset[this.name + 'Sticky'] === 'string';
            let speed = el.dataset[this.name + 'Speed']
                ? parseFloat(el.dataset[this.name + 'Speed']) / 10
                : false;
            let offset =
                typeof el.dataset[this.name + 'Offset'] === 'string'
                    ? el.dataset[this.name + 'Offset'].split(',')
                    : this.offset;

            let target = el.dataset[this.name + 'Target'];
            let targetEl;

            if (target !== undefined) {
                targetEl = document.querySelector(`${target}`);
            } else {
                targetEl = el;
            }

            const targetElBCR = targetEl.getBoundingClientRect();
            if (section === null) {
                top = targetElBCR.top + this.instance.scroll.y - getTranslate(targetEl).y;
                left = targetElBCR.left + this.instance.scroll.x - getTranslate(targetEl).x;
            } else {
                if (!section.inView) {
                    top = targetElBCR.top - getTranslate(section.el).y - getTranslate(targetEl).y;
                    left = targetElBCR.left - getTranslate(section.el).x - getTranslate(targetEl).x;
                } else {
                    top = targetElBCR.top + this.instance.scroll.y - getTranslate(targetEl).y;
                    left = targetElBCR.left + this.instance.scroll.x - getTranslate(targetEl).x;
                }
            }

            let bottom = top + targetEl.offsetHeight;
            let right = left + targetEl.offsetWidth;
            let middle = {
                x: (right - left) / 2 + left,
                y: (bottom - top) / 2 + top
            };

            if (sticky) {
                const elBCR = el.getBoundingClientRect();
                const elTop = elBCR.top;
                const elLeft = elBCR.left;

                const elDistance = {
                    x: elLeft - left,
                    y: elTop - top
                };

                top += window.innerHeight;
                left += window.innerWidth;
                bottom =
                    elTop +
                    targetEl.offsetHeight -
                    el.offsetHeight -
                    elDistance[this.directionAxis];
                right =
                    elLeft + targetEl.offsetWidth - el.offsetWidth - elDistance[this.directionAxis];
                middle = {
                    x: (right - left) / 2 + left,
                    y: (bottom - top) / 2 + top
                };
            }

            if (repeat == 'false') {
                repeat = false;
            } else if (repeat != undefined) {
                repeat = true;
            } else {
                repeat = this.repeat;
            }

            let relativeOffset = [0, 0];
            if (offset) {
                if (this.direction === 'horizontal') {
                    for (var i = 0; i < offset.length; i++) {
                        if (typeof offset[i] == 'string') {
                            if (offset[i].includes('%')) {
                                relativeOffset[i] = parseInt(
                                    (offset[i].replace('%', '') * this.windowWidth) / 100
                                );
                            } else {
                                relativeOffset[i] = parseInt(offset[i]);
                            }
                        } else {
                            relativeOffset[i] = offset[i];
                        }
                    }
                    left = left + relativeOffset[0];
                    right = right - relativeOffset[1];
                } else {
                    for (var i = 0; i < offset.length; i++) {
                        if (typeof offset[i] == 'string') {
                            if (offset[i].includes('%')) {
                                relativeOffset[i] = parseInt(
                                    (offset[i].replace('%', '') * this.windowHeight) / 100
                                );
                            } else {
                                relativeOffset[i] = parseInt(offset[i]);
                            }
                        } else {
                            relativeOffset[i] = offset[i];
                        }
                    }
                    top = top + relativeOffset[0];
                    bottom = bottom - relativeOffset[1];
                }
            }

            const mappedEl = {
                el,
                id: id,
                class: cl,
                section: section,
                top,
                middle,
                bottom,
                left,
                right,
                offset,
                progress: 0,
                repeat,
                inView: false,
                call,
                speed,
                delay,
                position,
                targetEl: targetEl,
                direction,
                sticky
            };

            this.els[id] = mappedEl;
            if (el.classList.contains(cl)) {
                this.setInView(this.els[id], id);
            }

            if (speed !== false || sticky) {
                this.parallaxElements[id] = mappedEl;
            }
        });
        // });
    }

    updateElements() {
        Object.entries(this.els).forEach(([i, el]) => {
            const top = el.targetEl.getBoundingClientRect().top + this.instance.scroll.y;
            const bottom = top + el.targetEl.offsetHeight;
            const relativeOffset = this.getRelativeOffset(el.offset);

            this.els[i].top = top + relativeOffset[0];
            this.els[i].bottom = bottom - relativeOffset[1];
        });

        this.hasScrollTicking = false;
    }

    getRelativeOffset(offset) {
        let relativeOffset = [0, 0];

        if (offset) {
            for (var i = 0; i < offset.length; i++) {
                if (typeof offset[i] == 'string') {
                    if (offset[i].includes('%')) {
                        relativeOffset[i] = parseInt(
                            (offset[i].replace('%', '') * this.windowHeight) / 100
                        );
                    } else {
                        relativeOffset[i] = parseInt(offset[i]);
                    }
                } else {
                    relativeOffset[i] = offset[i];
                }
            }
        }

        return relativeOffset;
    }

    transform(element, x, y, delay) {
        let transform;

        if (!delay) {
            transform = `matrix3d(1,0,0.00,0,0.00,1,0.00,0,0,0,1,0,${x},${y},0,1)`;
        } else {
            let start = getTranslate(element);
            let lerpX = lerp(start.x, x, delay);
            let lerpY = lerp(start.y, y, delay);

            transform = `matrix3d(1,0,0.00,0,0.00,1,0.00,0,0,0,1,0,${lerpX},${lerpY},0,1)`;
        }

        element.style.webkitTransform = transform;
        element.style.msTransform = transform;
        element.style.transform = transform;
    }

    transformElements(isForced, setAllElements = false) {
        const scrollRight = this.instance.scroll.x + this.windowWidth;
        const scrollBottom = this.instance.scroll.y + this.windowHeight;

        const scrollMiddle = {
            x: this.instance.scroll.x + this.windowMiddle.x,
            y: this.instance.scroll.y + this.windowMiddle.y
        };

        Object.entries(this.parallaxElements).forEach(([i, current]) => {
            let transformDistance = false;

            if (isForced) {
                transformDistance = 0;
            }

            if (current.inView || setAllElements) {
                switch (current.position) {
                    case 'top':
                        transformDistance =
                            this.instance.scroll[this.directionAxis] * -current.speed;
                        break;

                    case 'elementTop':
                        transformDistance = (scrollBottom - current.top) * -current.speed;
                        break;

                    case 'bottom':
                        transformDistance =
                            (this.instance.limit[this.directionAxis] -
                                scrollBottom +
                                this.windowHeight) *
                            current.speed;
                        break;

                    case 'left':
                        transformDistance =
                            this.instance.scroll[this.directionAxis] * -current.speed;
                        break;

                    case 'elementLeft':
                        transformDistance = (scrollRight - current.left) * -current.speed;
                        break;

                    case 'right':
                        transformDistance =
                            (this.instance.limit[this.directionAxis] -
                                scrollRight +
                                this.windowHeight) *
                            current.speed;
                        break;

                    default:
                        transformDistance =
                            (scrollMiddle[this.directionAxis] -
                                current.middle[this.directionAxis]) *
                            -current.speed;
                        break;
                }
            }

            if (current.sticky) {
                if (current.inView) {
                    if (this.direction === 'horizontal') {
                        transformDistance =
                            this.instance.scroll.x - current.left + window.innerWidth;
                    } else {
                        transformDistance =
                            this.instance.scroll.y - current.top + window.innerHeight;
                    }
                } else {
                    if (this.direction === 'horizontal') {
                        if (
                            this.instance.scroll.x < current.left - window.innerWidth &&
                            this.instance.scroll.x < current.left - window.innerWidth / 2
                        ) {
                            transformDistance = 0;
                        } else if (
                            this.instance.scroll.x > current.right &&
                            this.instance.scroll.x > current.right + 100
                        ) {
                            transformDistance = current.right - current.left + window.innerWidth;
                        } else {
                            transformDistance = false;
                        }
                    } else {
                        if (
                            this.instance.scroll.y < current.top - window.innerHeight &&
                            this.instance.scroll.y < current.top - window.innerHeight / 2
                        ) {
                            transformDistance = 0;
                        } else if (
                            this.instance.scroll.y > current.bottom &&
                            this.instance.scroll.y > current.bottom + 100
                        ) {
                            transformDistance = current.bottom - current.top + window.innerHeight;
                        } else {
                            transformDistance = false;
                        }
                    }
                }
            }

            if (transformDistance !== false) {
                if (
                    current.direction === 'horizontal' ||
                    (this.direction === 'horizontal' && current.direction !== 'vertical')
                ) {
                    this.transform(
                        current.el,
                        transformDistance,
                        0,
                        isForced ? false : current.delay
                    );
                } else {
                    this.transform(
                        current.el,
                        0,
                        transformDistance,
                        isForced ? false : current.delay
                    );
                }
            }
        });
    }

    /**
     * Scroll to a desired target.
     *
     * @param  Available options :
     *          target {node, string, "top", "bottom", int} - The DOM element we want to scroll to
     *          options {object} - Options object for additionnal settings.
     * @return {void}
     */
    scrollTo(target, options = {}) {
        // Parse options
        let offset = parseInt(options.offset) || 0; // An offset to apply on top of given `target` or `sourceElem`'s target
        const callback = options.callback ? options.callback : false; // function called when scrollTo completes (note that it won't wait for lerp to stabilize)

        if (typeof target === 'string') {
            // Selector or boundaries
            if (target === 'top') {
                target = this.html;
            } else if (target === 'bottom') {
                target = this.html.offsetHeight - window.innerHeight;
            } else {
                target = document.querySelector(target);
                // If the query fails, abort
                if (!target) {
                    return;
                }
            }
        } else if (typeof target === 'number') {
            // Absolute coordinate
            target = parseInt(target);
        } else if (target && target.tagName) {
            // DOM Element
            // We good 👍
        } else {
            console.warn('`target` parameter is not valid');
            return;
        }

        // We have a target that is not a coordinate yet, get it
        if (typeof target !== 'number') {
            offset = target.getBoundingClientRect().top + offset + this.instance.scroll.y;
        } else {
            offset = target + offset;
        }

        const isTargetReached = () => {
            return parseInt(window.pageYOffset) === parseInt(offset);
        };
        if (callback) {
            if (isTargetReached()) {
                callback();
                return;
            } else {
                let onScroll = function () {
                    if (isTargetReached()) {
                        window.removeEventListener('scroll', onScroll);
                        callback();
                    }
                };
                window.addEventListener('scroll', onScroll);
            }
        }

        window.scrollTo({
            top: offset,
            behavior: 'smooth'
        });
    }

    update() {
        this.addElements();
        this.detectElements();
    }

    destroy() {
        super.destroy();

        window.removeEventListener('scroll', this.checkScroll, false);
    }
}
