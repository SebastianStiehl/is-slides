/*!
 Deck JS - deck.goto
 Copyright (c) 2011 Caleb Troughton
 Dual licensed under the MIT license and GPL license.
 https://github.com/imakewebthings/deck.js/blob/master/MIT-license.txt
 https://github.com/imakewebthings/deck.js/blob/master/GPL-license.txt
 */

/*
 This module adds the necessary methods and key bindings to show and hide a form
 for jumping to any slide number/id in the deck (and processes that form
 accordingly). The form-showing state is indicated by the presence of a class on
 the deck container.
 */
(function($, deck, undefined) {
    var $d = $(document);

    /*
     Extends defaults/options.

     options.classes.goto
     This class is added to the deck container when showing the Go To Slide
     form.

     options.selectors.gotoDatalist
     The element that matches this selector is the datalist element that will
     be populated with options for each of the slide ids.  In browsers that
     support the datalist element, this provides a drop list of slide ids to
     aid the user in selecting a slide.

     options.selectors.gotoForm
     The element that matches this selector is the form that is submitted
     when a user hits enter after typing a slide number/id in the gotoInput
     element.

     options.selectors.gotoInput
     The element that matches this selector is the text input field for
     entering a slide number/id in the Go To Slide form.

     options.keys.goto
     The numeric keycode used to show the Go To Slide form.

     options.countNested
     If false, only top level slides will be counted when entering a
     slide number.
     */
    $.extend(true, $[deck].defaults, {
        classes: {
            goto: 'deck-goto'
        },

        selectors: {
            gotoDatalist: '#goto-datalist',
            gotoForm: '.goto-form',
            gotoInput: '#goto-slide'
        },

        keys: {
            goto: 71 // g
        },

        countNested: true
    });

    /*
     jQuery.deck('showGoTo')

     Shows the Go To Slide form by adding the class specified by the goto class
     option to the deck container.
     */
    $[deck]('extend', 'showGoTo', function() {
        $[deck]('getContainer').addClass($[deck]('getOptions').classes.goto);
        $($[deck]('getOptions').selectors.gotoInput).focus();
    });

    /*
     jQuery.deck('hideGoTo')

     Hides the Go To Slide form by removing the class specified by the goto class
     option from the deck container.
     */
    $[deck]('extend', 'hideGoTo', function() {
        $($[deck]('getOptions').selectors.gotoInput).blur();
        $[deck]('getContainer').removeClass($[deck]('getOptions').classes.goto);
    });

    /*
     jQuery.deck('toggleGoTo')

     Toggles between showing and hiding the Go To Slide form.
     */
    $[deck]('extend', 'toggleGoTo', function() {
        $[deck]($[deck]('getContainer').hasClass($[deck]('getOptions').classes.goto) ? 'hideGoTo' : 'showGoTo');
    });

    $d.bind('deck.init', function() {
        var opts = $[deck]('getOptions'),
            $datalist = $(opts.selectors.gotoDatalist),
            slideTest = $.map([
                opts.classes.before,
                opts.classes.previous,
                opts.classes.current,
                opts.classes.next,
                opts.classes.after
            ], function(el, i) {
                return '.' + el;
            }).join(', '),
            rootCounter = 1;

        // Bind key events
        $d.unbind('keydown.deckgoto').bind('keydown.deckgoto', function(e) {
            var key = $[deck]('getOptions').keys.goto;

            if (e.which === key || $.inArray(e.which, key) > -1) {
                e.preventDefault();
                $[deck]('toggleGoTo');
            }
        });

        /* Populate datalist and work out countNested*/
        $.each($[deck]('getSlides'), function(i, $slide) {
            var id = $slide.attr('id'),
                $parentSlides = $slide.parentsUntil(opts.selectors.container, slideTest);

            if (id) {
                $datalist.append('<option value="' + id + '">');
            }

            if ($parentSlides.length) {
                $slide.removeData('rootIndex');
            }
            else if (!opts.countNested) {
                $slide.data('rootIndex', rootCounter);
                ++rootCounter;
            }
        });

        // Process form submittal, go to the slide entered
        $(opts.selectors.gotoForm)
            .unbind('submit.deckgoto')
            .bind('submit.deckgoto', function(e) {
                var $field = $($[deck]('getOptions').selectors.gotoInput),
                    ndx = parseInt($field.val(), 10);

                if (!$[deck]('getOptions').countNested) {
                    if (ndx >= rootCounter) return false;
                    $.each($[deck]('getSlides'), function(i, $slide) {
                        if ($slide.data('rootIndex') === ndx) {
                            ndx = i + 1;
                            return false;
                        }
                    });
                }

                $[deck]('go', isNaN(ndx) ? $field.val() : ndx - 1);
                $[deck]('hideGoTo');
                $field.val('');

                e.preventDefault();
            });

        // Dont let keys in the input trigger deck actions
        $(opts.selectors.gotoInput)
            .unbind('keydown.deckgoto')
            .bind('keydown.deckgoto', function(e) {
                e.stopPropagation();
            });
    });
})(jQuery, 'deck');

/*!
 Deck JS - deck.hash
 Copyright (c) 2011 Caleb Troughton
 Dual licensed under the MIT license and GPL license.
 https://github.com/imakewebthings/deck.js/blob/master/MIT-license.txt
 https://github.com/imakewebthings/deck.js/blob/master/GPL-license.txt
 */

/*
 This module adds deep linking to individual slides, enables internal links
 to slides within decks, and updates the address bar with the hash as the user
 moves through the deck. A permalink anchor is also updated. Standard themes
 hide this link in browsers that support the History API, and show it for
 those that do not. Slides that do not have an id are assigned one according to
 the hashPrefix option. In addition to the on-slide container state class
 kept by core, this module adds an on-slide state class that uses the id of each
 slide.
 */
(function ($, deck, window, undefined) {
    var $d = $(document),
        $window = $(window),

    /* Collection of internal fragment links in the deck */
        $internals,

    /*
     Internal only function.  Given a string, extracts the id from the hash,
     matches it to the appropriate slide, and navigates there.
     */
        goByHash = function(str) {
            var id = str.substr(str.indexOf("#") + 1),
                slides = $[deck]('getSlides');

            $.each(slides, function(i, $el) {
                if ($el.attr('id') === id) {
                    $[deck]('go', i);
                    return false;
                }
            });

            // If we don't set these to 0 the container scrolls due to hashchange
            $[deck]('getContainer').scrollLeft(0).scrollTop(0);
        };

    /*
     Extends defaults/options.

     options.selectors.hashLink
     The element matching this selector has its href attribute updated to
     the hash of the current slide as the user navigates through the deck.

     options.hashPrefix
     Every slide that does not have an id is assigned one at initialization.
     Assigned ids take the form of hashPrefix + slideIndex, e.g., slide-0,
     slide-12, etc.

     options.preventFragmentScroll
     When deep linking to a hash of a nested slide, this scrolls the deck
     container to the top, undoing the natural browser behavior of scrolling
     to the document fragment on load.
     */
    $.extend(true, $[deck].defaults, {
        selectors: {
            hashLink: '.deck-permalink'
        },

        hashPrefix: 'slide-',
        preventFragmentScroll: true
    });


    $d.bind('deck.init', function() {
        var opts = $[deck]('getOptions');
        $internals = $(),
            slides = $[deck]('getSlides');

        $.each(slides, function(i, $el) {
            var hash;

            /* Hand out ids to the unfortunate slides born without them */
            if (!$el.attr('id') || $el.data('deckAssignedId') === $el.attr('id')) {
                $el.attr('id', opts.hashPrefix + i);
                $el.data('deckAssignedId', opts.hashPrefix + i);
            }

            hash ='#' + $el.attr('id');

            /* Deep link to slides on init */
            if (hash === window.location.hash) {
                $[deck]('go', i);
            }

            /* Add internal links to this slide */
            $internals = $internals.add('a[href="' + hash + '"]');
        });

        if (!Modernizr.hashchange) {
            /* Set up internal links using click for the poor browsers
             without a hashchange event. */
            $internals.unbind('click.deckhash').bind('click.deckhash', function(e) {
                goByHash($(this).attr('href'));
            });
        }

        /* Set up first id container state class */
        if (slides.length) {
            $[deck]('getContainer').addClass(opts.classes.onPrefix + $[deck]('getSlide').attr('id'));
        };
    })
        /* Update permalink, address bar, and state class on a slide change */
        .bind('deck.change', function(e, from, to) {
            var hash = '#' + $[deck]('getSlide', to).attr('id'),
                hashPath = window.location.href.replace(/#.*/, '') + hash,
                opts = $[deck]('getOptions'),
                osp = opts.classes.onPrefix,
                $c = $[deck]('getContainer');

            $c.removeClass(osp + $[deck]('getSlide', from).attr('id'));
            $c.addClass(osp + $[deck]('getSlide', to).attr('id'));

            $(opts.selectors.hashLink).attr('href', hashPath);
            if (Modernizr.history) {
                window.history.replaceState({}, "", hashPath);
            }
        });

    /* Deals with internal links in modern browsers */
    $window.bind('hashchange.deckhash', function(e) {
        if (e.originalEvent && e.originalEvent.newURL) {
            goByHash(e.originalEvent.newURL);
        }
        else {
            goByHash(window.location.hash);
        }
    })
        /* Prevent scrolling on deep links */
        .bind('load', function() {
            if ($[deck]('getOptions').preventFragmentScroll) {
                $[deck]('getContainer').scrollLeft(0).scrollTop(0);
            }
        });
})(jQuery, 'deck', this);/*!
 Deck JS - deck.menu
 Copyright (c) 2011 Caleb Troughton
 Dual licensed under the MIT license and GPL license.
 https://github.com/imakewebthings/deck.js/blob/master/MIT-license.txt
 https://github.com/imakewebthings/deck.js/blob/master/GPL-license.txt
 */

/*
 This module adds the methods and key binding to show and hide a menu of all
 slides in the deck. The deck menu state is indicated by the presence of a class
 on the deck container.
 */
(function($, deck, undefined) {
    var $d = $(document),
        rootSlides; // Array of top level slides

    /*
     Extends defaults/options.

     options.classes.menu
     This class is added to the deck container when showing the slide menu.

     options.keys.menu
     The numeric keycode used to toggle between showing and hiding the slide
     menu.

     options.touch.doubletapWindow
     Two consecutive touch events within this number of milliseconds will
     be considered a double tap, and will toggle the menu on touch devices.
     */
    $.extend(true, $[deck].defaults, {
        classes: {
            menu: 'deck-menu'
        },

        keys: {
            menu: 77 // m
        },

        touch: {
            doubletapWindow: 400
        }
    });

    /*
     jQuery.deck('showMenu')

     Shows the slide menu by adding the class specified by the menu class option
     to the deck container.
     */
    $[deck]('extend', 'showMenu', function() {
        var $c = $[deck]('getContainer'),
            opts = $[deck]('getOptions');

        if ($c.hasClass(opts.classes.menu)) return;

        // Hide through loading class to short-circuit transitions (perf)
        $c.addClass([opts.classes.loading, opts.classes.menu].join(' '));

        /* Forced to do this in JS until CSS learns second-grade math. Save old
         style value for restoration when menu is hidden. */
        if (Modernizr.csstransforms) {
            $.each(rootSlides, function(i, $slide) {
                $slide.data('oldStyle', $slide.attr('style'));
                $slide.css({
                    'position': 'absolute',
                    'left': ((i % 4) * 25) + '%',
                    'top': (Math.floor(i / 4) * 25) + '%'
                });
            });
        }

        // Need to ensure the loading class renders first, then remove
        window.setTimeout(function() {
            $c.removeClass(opts.classes.loading)
                .scrollTop($[deck]('getSlide').offset().top);
        }, 0);
    });

    /*
     jQuery.deck('hideMenu')

     Hides the slide menu by removing the class specified by the menu class
     option from the deck container.
     */
    $[deck]('extend', 'hideMenu', function() {
        var $c = $[deck]('getContainer'),
            opts = $[deck]('getOptions');

        if (!$c.hasClass(opts.classes.menu)) return;

        $c.removeClass(opts.classes.menu);
        $c.addClass(opts.classes.loading);

        /* Restore old style value */
        if (Modernizr.csstransforms) {
            $.each(rootSlides, function(i, $slide) {
                var oldStyle = $slide.data('oldStyle');

                $slide.attr('style', oldStyle ? oldStyle : '');
            });
        }

        window.setTimeout(function() {
            $c.removeClass(opts.classes.loading).scrollTop(0);
        }, 0);
    });

    /*
     jQuery.deck('toggleMenu')

     Toggles between showing and hiding the slide menu.
     */
    $[deck]('extend', 'toggleMenu', function() {
        $[deck]('getContainer').hasClass($[deck]('getOptions').classes.menu) ?
            $[deck]('hideMenu') : $[deck]('showMenu');
    });

    $d.bind('deck.init', function() {
        var opts = $[deck]('getOptions'),
            touchEndTime = 0,
            currentSlide,
            slideTest = $.map([
                opts.classes.before,
                opts.classes.previous,
                opts.classes.current,
                opts.classes.next,
                opts.classes.after
            ], function(el, i) {
                return '.' + el;
            }).join(', ');

        // Build top level slides array
        rootSlides = [];
        $.each($[deck]('getSlides'), function(i, $el) {
            if (!$el.parentsUntil(opts.selectors.container, slideTest).length) {
                rootSlides.push($el);
            }
        });

        // Bind key events
        $d.unbind('keydown.deckmenu').bind('keydown.deckmenu', function(e) {
            if (e.which === opts.keys.menu || $.inArray(e.which, opts.keys.menu) > -1) {
                $[deck]('toggleMenu');
                e.preventDefault();
            }
        });

        // Double tap to toggle slide menu for touch devices
        $[deck]('getContainer').unbind('touchstart.deckmenu').bind('touchstart.deckmenu', function(e) {
            currentSlide = $[deck]('getSlide');
        })
            .unbind('touchend.deckmenu').bind('touchend.deckmenu', function(e) {
                var now = Date.now();

                // Ignore this touch event if it caused a nav change (swipe)
                if (currentSlide !== $[deck]('getSlide')) return;

                if (now - touchEndTime < opts.touch.doubletapWindow) {
                    $[deck]('toggleMenu');
                    e.preventDefault();
                }
                touchEndTime = now;
            });

        // Selecting slides from the menu
        $.each($[deck]('getSlides'), function(i, $s) {
            $s.unbind('click.deckmenu').bind('click.deckmenu', function(e) {
                if (!$[deck]('getContainer').hasClass(opts.classes.menu)) return;

                $[deck]('go', i);
                $[deck]('hideMenu');
                e.stopPropagation();
                e.preventDefault();
            });
        });
    })
        .bind('deck.change', function(e, from, to) {
            var container = $[deck]('getContainer');

            if (container.hasClass($[deck]('getOptions').classes.menu)) {
                container.scrollTop($[deck]('getSlide', to).offset().top);
            }
        });
})(jQuery, 'deck');

/*!
 Deck JS - deck.navigation
 Copyright (c) 2011 Caleb Troughton
 Dual licensed under the MIT license and GPL license.
 https://github.com/imakewebthings/deck.js/blob/master/MIT-license.txt
 https://github.com/imakewebthings/deck.js/blob/master/GPL-license.txt
 */

/*
 This module adds clickable previous and next links to the deck.
 */
(function($, deck, undefined) {
    var $d = $(document),

    /* Updates link hrefs, and disabled states if last/first slide */
        updateButtons = function(e, from, to) {
            var opts = $[deck]('getOptions'),
                last = $[deck]('getSlides').length - 1,
                prevSlide = $[deck]('getSlide', to - 1),
                nextSlide = $[deck]('getSlide', to + 1),
                hrefBase = window.location.href.replace(/#.*/, ''),
                prevId = prevSlide ? prevSlide.attr('id') : undefined,
                nextId = nextSlide ? nextSlide.attr('id') : undefined;

            $(opts.selectors.previousLink)
                .toggleClass(opts.classes.navDisabled, !to)
                .attr('href', hrefBase + '#' + (prevId ? prevId : ''));
            $(opts.selectors.nextLink)
                .toggleClass(opts.classes.navDisabled, to === last)
                .attr('href', hrefBase + '#' + (nextId ? nextId : ''));
        };

    /*
     Extends defaults/options.

     options.classes.navDisabled
     This class is added to a navigation link when that action is disabled.
     It is added to the previous link when on the first slide, and to the
     next link when on the last slide.

     options.selectors.nextLink
     The elements that match this selector will move the deck to the next
     slide when clicked.

     options.selectors.previousLink
     The elements that match this selector will move to deck to the previous
     slide when clicked.
     */
    $.extend(true, $[deck].defaults, {
        classes: {
            navDisabled: 'deck-nav-disabled'
        },

        selectors: {
            nextLink: '.deck-next-link',
            previousLink: '.deck-prev-link'
        }
    });

    $d.bind('deck.init', function() {
        var opts = $[deck]('getOptions'),
            slides = $[deck]('getSlides'),
            $current = $[deck]('getSlide'),
            ndx;

        // Setup prev/next link events
        $(opts.selectors.previousLink)
            .unbind('click.decknavigation')
            .bind('click.decknavigation', function(e) {
                $[deck]('prev');
                e.preventDefault();
            });

        $(opts.selectors.nextLink)
            .unbind('click.decknavigation')
            .bind('click.decknavigation', function(e) {
                $[deck]('next');
                e.preventDefault();
            });

        // Find where we started in the deck and set initial states
        $.each(slides, function(i, $slide) {
            if ($slide === $current) {
                ndx = i;
                return false;
            }
        });
        updateButtons(null, ndx, ndx);
    })
        .bind('deck.change', updateButtons);
})(jQuery, 'deck');

/*!
 Deck JS - deck.scale
 Copyright (c) 2011-2012 Caleb Troughton
 Dual licensed under the MIT license and GPL license.
 https://github.com/imakewebthings/deck.js/blob/master/MIT-license.txt
 https://github.com/imakewebthings/deck.js/blob/master/GPL-license.txt
 */

/*
 This module adds automatic scaling to the deck.  Slides are scaled down
 using CSS transforms to fit within the deck container. If the container is
 big enough to hold the slides without scaling, no scaling occurs. The user
 can disable and enable scaling with a keyboard shortcut.

 Note: CSS transforms may make Flash videos render incorrectly.  Presenters
 that need to use video may want to disable scaling to play them.  HTML5 video
 works fine.
 */
(function($, deck, window, undefined) {
    var $d = $(document),
        $w = $(window),
        baseHeight, // Value to scale against
        timer, // Timeout id for debouncing
        rootSlides,

    /*
     Internal function to do all the dirty work of scaling the slides.
     */
        scaleDeck = function() {
            var opts = $[deck]('getOptions'),
                obh = opts.baseHeight,
                $container = $[deck]('getContainer'),
                baseHeight = obh ? obh : $container.height();

            // Scale each slide down if necessary (but don't scale up)
            $.each(rootSlides, function(i, $slide) {
                var slideHeight = $slide.innerHeight(),
                    $scaler = $slide.find('.' + opts.classes.scaleSlideWrapper),
                    scale = $container.hasClass(opts.classes.scale) ?
                        baseHeight / slideHeight :
                        1;

                $.each('Webkit Moz O ms Khtml'.split(' '), function(i, prefix) {
                    if (scale === 1) {
                        $scaler.css(prefix + 'Transform', '');
                    }
                    else {
                        $scaler.css(prefix + 'Transform', 'scale(' + scale + ')');
                    }
                });
            });
        }

    /*
     Extends defaults/options.

     options.classes.scale
     This class is added to the deck container when scaling is enabled.
     It is enabled by default when the module is included.

     options.classes.scaleSlideWrapper
     Scaling is done using a wrapper around the contents of each slide. This
     class is applied to that wrapper.

     options.keys.scale
     The numeric keycode used to toggle enabling and disabling scaling.

     options.baseHeight
     When baseHeight is falsy, as it is by default, the deck is scaled in
     proportion to the height of the deck container. You may instead specify
     a height as a number of px, and slides will be scaled against this
     height regardless of the container size.

     options.scaleDebounce
     Scaling on the browser resize event is debounced. This number is the
     threshold in milliseconds. You can learn more about debouncing here:
     http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/

     */
    $.extend(true, $[deck].defaults, {
        classes: {
            scale: 'deck-scale',
            scaleSlideWrapper: 'deck-slide-scaler'
        },

        keys: {
            scale: 83 // s
        },

        baseHeight: null,
        scaleDebounce: 200
    });

    /*
     jQuery.deck('disableScale')

     Disables scaling and removes the scale class from the deck container.
     */
    $[deck]('extend', 'disableScale', function() {
        $[deck]('getContainer').removeClass($[deck]('getOptions').classes.scale);
        scaleDeck();
    });

    /*
     jQuery.deck('enableScale')

     Enables scaling and adds the scale class to the deck container.
     */
    $[deck]('extend', 'enableScale', function() {
        $[deck]('getContainer').addClass($[deck]('getOptions').classes.scale);
        scaleDeck();
    });

    /*
     jQuery.deck('toggleScale')

     Toggles between enabling and disabling scaling.
     */
    $[deck]('extend', 'toggleScale', function() {
        var $c = $[deck]('getContainer');
        $[deck]($c.hasClass($[deck]('getOptions').classes.scale) ?
            'disableScale' : 'enableScale');
    });

    $d.bind('deck.init', function() {
        var opts = $[deck]('getOptions'),
            slideTest = $.map([
                opts.classes.before,
                opts.classes.previous,
                opts.classes.current,
                opts.classes.next,
                opts.classes.after
            ], function(el, i) {
                return '.' + el;
            }).join(', ');

        // Build top level slides array
        rootSlides = [];
        $.each($[deck]('getSlides'), function(i, $el) {
            if (!$el.parentsUntil(opts.selectors.container, slideTest).length) {
                rootSlides.push($el);
            }
        });

        // Use a wrapper on each slide to handle content scaling
        $.each(rootSlides, function(i, $slide) {
            $slide.children().wrapAll('<div class="' + opts.classes.scaleSlideWrapper + '"/>');
        });

        // Debounce the resize scaling
        $w.unbind('resize.deckscale').bind('resize.deckscale', function() {
            window.clearTimeout(timer);
            timer = window.setTimeout(scaleDeck, opts.scaleDebounce);
        })
            // Scale once on load, in case images or something change layout
            .unbind('load.deckscale').bind('load.deckscale', scaleDeck);

        // Bind key events
        $d.unbind('keydown.deckscale').bind('keydown.deckscale', function(e) {
            if (e.which === opts.keys.scale || $.inArray(e.which, opts.keys.scale) > -1) {
                $[deck]('toggleScale');
                e.preventDefault();
            }
        });

        // Enable scale on init
        $[deck]('enableScale');
    });
})(jQuery, 'deck', this);

/*!
 Deck JS - deck.status
 Copyright (c) 2011 Caleb Troughton
 Dual licensed under the MIT license and GPL license.
 https://github.com/imakewebthings/deck.js/blob/master/MIT-license.txt
 https://github.com/imakewebthings/deck.js/blob/master/GPL-license.txt
 */

/*
 This module adds a (current)/(total) style status indicator to the deck.
 */
(function($, deck, undefined) {
    var $d = $(document),

        updateCurrent = function(e, from, to) {
            var opts = $[deck]('getOptions');

            $(opts.selectors.statusCurrent).text(opts.countNested ?
                to + 1 :
                $[deck]('getSlide', to).data('rootSlide')
            );
        };

    /*
     Extends defaults/options.

     options.selectors.statusCurrent
     The element matching this selector displays the current slide number.

     options.selectors.statusTotal
     The element matching this selector displays the total number of slides.

     options.countNested
     If false, only top level slides will be counted in the current and
     total numbers.
     */
    $.extend(true, $[deck].defaults, {
        selectors: {
            statusCurrent: '.deck-status-current',
            statusTotal: '.deck-status-total'
        },

        countNested: true
    });

    $d.bind('deck.init', function() {
        var opts = $[deck]('getOptions'),
            slides = $[deck]('getSlides'),
            $current = $[deck]('getSlide'),
            ndx;

        // Set total slides once
        if (opts.countNested) {
            $(opts.selectors.statusTotal).text(slides.length);
        }
        else {
            /* Determine root slides by checking each slide's ancestor tree for
             any of the slide classes. */
            var rootIndex = 1,
                slideTest = $.map([
                    opts.classes.before,
                    opts.classes.previous,
                    opts.classes.current,
                    opts.classes.next,
                    opts.classes.after
                ], function(el, i) {
                    return '.' + el;
                }).join(', ');

            /* Store the 'real' root slide number for use during slide changes. */
            $.each(slides, function(i, $el) {
                var $parentSlides = $el.parentsUntil(opts.selectors.container, slideTest);

                $el.data('rootSlide', $parentSlides.length ?
                    $parentSlides.last().data('rootSlide') :
                    rootIndex++
                );
            });

            $(opts.selectors.statusTotal).text(rootIndex - 1);
        }

        // Find where we started in the deck and set initial state
        $.each(slides, function(i, $el) {
            if ($el === $current) {
                ndx = i;
                return false;
            }
        });
        updateCurrent(null, ndx, ndx);
    })
        /* Update current slide number with each change event */
        .bind('deck.change', updateCurrent);
})(jQuery, 'deck');

