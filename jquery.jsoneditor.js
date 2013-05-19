// Simple yet flexible JSON editor plugin.
// Turns any element into a stylable interactive JSON editor.

// Copyright (c) 2011 David Durman

// Licensed under the MIT license (http://www.opensource.org/licenses/mit-license.php).

// Dependencies:

// * jQuery
// * JSON (use json2 library for browsers that do not support JSON natively)

// Example:

//     var myjson = { any: { json: { value: 1 } } };
//     var opt = { change: function() { /* called on every change */ } };
//     /* opt.propertyElement = '<textarea>'; */ // element of the property field, <input> is default
//     /* opt.valueElement = '<textarea>'; */  // element of the value field, <input> is default
//     $('#mydiv').jsonEditor(myjson, opt);

(function( $ ) {

    $.fn.jsonEditor = function(json, options) {
        options = options || {};

        // Make sure functions or other non-JSON data types are stripped down.
        json = parse(stringify(json));
		
        var K = function () { },
            onchange = options.change || K,
            onvalchange = options.valchange || K;

        return this.each(function() {
            JSONEditor($(this), json, onchange, onvalchange, options.propertyElement, options.valueElement);
        });

    };

    function JSONEditor(target, json, onchange, onvalchange, propertyElement, valueElement) {
        var opt = {
            target: target,
            onchange: onchange,
            onvalchange: onvalchange,
            original: json,
            propertyElement: propertyElement,
            valueElement: valueElement
        };
        construct(opt, json, opt.target);
        $('.property, .value', opt.target).live('blur focus', function() {
            $(this).toggleClass('editing');
        });
    }

    function isObject(o) { return Object.prototype.toString.call(o) == '[object Object]'; }
    function isArray(o) { return Object.prototype.toString.call(o) == '[object Array]'; }
    function isBoolean(o) { return Object.prototype.toString.call(o) == '[object Boolean]'; }
    function isNumber(o) { return Object.prototype.toString.call(o) == '[object Number]'; }
    function isString(o) { return Object.prototype.toString.call(o) == '[object String]'; }
    var types = 'object array boolean number string null';

    // Feeds object `o` with `value` at `path`. If value argument is omitted,
    // object at `path` will be deleted from `o`.
    // Example:
    //      feed({}, 'foo.bar.baz', 10);    // returns { foo: { bar: { baz: 10 } } }
    function feed(o, path, value) {
        var del = arguments.length == 2;

        if (path.indexOf('.') > -1) {
            var diver = o,
                i = 0,
                parts = path.split('.');
            for (var len = parts.length; i < len - 1; i++) {
                diver = diver[parts[i]];
            }
            if (del) delete diver[parts[len - 1]];
            else diver[parts[len - 1]] = value;
        } else {
            if (del) delete o[path];
            else o[path] = value;
        }
        return o;
    }

    // Get a property by path from object o if it exists. If not, return defaultValue.
    // Example:
    //     def({ foo: { bar: 5 } }, 'foo.bar', 100);   // returns 5
    //     def({ foo: { bar: 5 } }, 'foo.baz', 100);   // returns 100
    function def(o, path, defaultValue) {
        path = path.split('.');
        var i = 0;
        while (i < path.length) {
            if ((o = o[path[i++]]) == undefined) return defaultValue;
        }
        return o;
    }

    function error(reason) { if (window.console) { console.error(reason); } }

    function parse(str) {
        var res;
        try { res = JSON.parse(str); }
        catch (e) { res = null; error('JSON parse failed.'); }
        return res;
    }

    function stringify(obj) {
        var res;
        try { res = JSON.stringify(obj); }
        catch (e) { res = 'null'; error('JSON stringify failed.'); }
        return res;
    }

    function addExpander(item) {
        if (item.children('.expander').length == 0) {
            var expander =   $('<span>',  { 'class': 'expander' });
            expander.bind('click', function() {
                var item = $(this).parent();
                item.toggleClass('expanded');
            });
            item.prepend(expander);
        }
    }

    function construct(opt, json, root, path) {
        path = path || '';
        var expanded = {};
        root.find('.item').each(function () {
            if ($(this).hasClass('expanded')) {
                var path = $(this).data('path');
                var full_path = (path ? path + '.' : path) + $(this).children('.property').val();
                expanded[full_path] = true;
            }
        });

        doConstruct(opt, json, root, path, expanded);
    }

    function doConstruct(opt, json, root, path, expanded) {
        root.children('.item').remove();

        for (var key in json) {
            if (!json.hasOwnProperty(key)) continue;

            var item     = $('<div>',   { 'class': 'item', 'data-path': path }),
                property =   $(opt.propertyElement || '<input>', { 'class': 'property' }),
                value    =   $(opt.valueElement || '<input>', { 'class': 'value'    }),
                full_path = (path ? path + '.' : path) + key;

            if (isObject(json[key]) || isArray(json[key])) {
                addExpander(item);
                if (full_path in expanded) {
                    item.addClass('expanded');
                }
            }

            item.append(property).append(value);
            root.append(item);

            property.val(key).attr('title', key);

            if (isBoolean(json[key]))
            {
                value[0].type = 'checkbox';
                value[0].checked = json[key];
            }

            var val = stringify(json[key]);
            value.val(val).attr('title', val);

            assignType(item, json[key]);

            property.change(propertyChanged(opt));
            value.change(valueChanged(opt));

            if (isObject(json[key]) || isArray(json[key])) {
                doConstruct(opt, json[key], item, full_path, expanded);
            }
        }
    }

    function updateParents(el, opt) {
        $(el).parentsUntil(opt.target).each(function() {
            var path = $(this).data('path');
            path = (path ? path + '.' : path) + $(this).children('.property').val();
            var val = stringify(def(opt.original, path, null));
            $(this).children('.value').val(val).attr('title', val);
        });
    }

    function propertyChanged(opt) {
        return function() {
            var path = $(this).parent().data('path'),
                val = parse($(this).next().val()),
                newKey = $(this).val(),
                oldKey = $(this).attr('title');

            $(this).attr('title', newKey);

            feed(opt.original, (path ? path + '.' : '') + oldKey);
            if (newKey) feed(opt.original, (path ? path + '.' : '') + newKey, val);

            updateParents(this, opt);

            if (!newKey) $(this).parent().remove();

            opt.onchange();
        };
    }

    function valueChanged(opt) {
        return function() {
            var key = $(this).prev().val(),
                val = parse($(this).val() || 'null'),
                item = $(this).parent(),
                path = item.data('path');

            if (this.type == 'checkbox')
                val = this.checked;

            opt.onvalchange((path ? path + '.' : '') + key, val);

            feed(opt.original, (path ? path + '.' : '') + key, val);
            if ((isObject(val) || isArray(val)) && !$.isEmptyObject(val)) {
                construct(opt, val, item, (path ? path + '.' : '') + key);
                addExpander(item);
            } else {
                item.find('.expander, .item').remove();
            }

            assignType(item, val);

            updateParents(this, opt);

            opt.onchange();
        };
    }

    function assignType(item, val) {
        var className = 'null';

        if (isObject(val)) className = 'object';
        else if (isArray(val)) className = 'array';
        else if (isBoolean(val)) className = 'boolean';
        else if (isString(val)) className = 'string';
        else if (isNumber(val)) className = 'number';

        item.removeClass(types);
        item.addClass(className);
    }

})( jQuery );
