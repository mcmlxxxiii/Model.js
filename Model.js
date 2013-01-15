Model = (function () {

  function ModelError(code, message) {
    this.code = code;
    this.message = message;
  }

  ModelError.prototype.toString = function () {
    return this.code + ': ' + this.message;
  }


  function Model(name, options) {
    if (this.constructor != Model) {
      throw new ModelError('M01', 'new Model classes should be created with keyword `new`!');
    }

    if (typeof name != 'string') {
      throw new ModelError('M02', '`new Model` expects its 1st argument to be a string name of a new class!');
    }

    if (Model.classes[name]) {
      throw new ModelError('M07', 'models class with that name already exists!');
    }

    if (!$.isPlainObject(options)) {
      throw new ModelError('M03', '`new Model` expects its 2nd argument to be an options object!');
    }

    if (!options.attributes || options.attributes.constructor.name !== 'Array' || options.attributes.length === 0) {
      throw new ModelError('M04', "new model's options should contain nonempty attributes array!");
    }

    var i, j, attrName,
      attrNotation,
      attrDescribed,
      attributesDescribed = [],
      attributeNames = [];

    for (i = 0; i < options.attributes.length; i++) {
      attrNotation = options.attributes[i];
      attrDescribed = Model._parseAttributeNotation(attrNotation);
      if (attrDescribed === false) {
        throw new ModelError('M05', "attributes should be valid notation strings!");
      }
      attributesDescribed.push( attrDescribed );
    }

    for (i = 0; i < attributesDescribed.length; i++) {
      attrDescribed = attributesDescribed[i];
      for (j = 0; j < attrDescribed.validators.length; j++) {
        if (!Model._validators[attrDescribed.validators[j]]) {
          throw new ModelError('M06', "attributes should be described with existing validators!");
        }
      }
    }


    function Class() {
      if (this.constructor != Class) {
        throw new ModelError('C01', "Class instances should be created with keyword `new`!");
      }

      var obj = this, data, attrName;

      if (arguments[0] !== undefined && !$.isPlainObject(arguments[0])) {
        throw new ModelError('C02', "Class instance should receive data object on creation!");
      }

      data = arguments[0] || {};
      obj._data = {};

      for (attrName in data) {
        if (Class.attributes.indexOf(attrName) >= 0) {
          obj._set(attrName, data[attrName]);
        }
      }
    }

    Class.className = name;

    Class.attributes = [];
    Class._validators = {};

    for (i = 0; i < attributesDescribed.length; i++) {
      attrName = attributesDescribed[i].attrName;
      Class.attributes.push( attrName );
      Class._validators[ attrName ] = $.extend([], attributesDescribed[i].validators);
    }

    Class.idAttr = Class.attributes[0];


    Class.Data = function (instance) {
      this._instance = instance;
    }

    for (i = 0; i < Class.attributes.length; i++) {
      attrName = Class.attributes[i];
      Class.Data.prototype.__defineGetter__(attrName, function () {
        return this._instance._get(attrName);
      });
      Class.Data.prototype.__defineSetter__(attrName, function (value) {
        this._instance._set(attrName, value);
      });
    }



    Class.prototype.__defineGetter__('data', function () {
      return new this.constructor.Data(this);
    });

    Class.prototype.__defineSetter__('data', function (data) {
    });

    Class.prototype.__defineGetter__('isNew', function () {
      return this._data[ this.constructor.idAttr ] === undefined;
    });

    Class.prototype._get = function (attrName) {
      return this._data[attrName];
    }

    Class.prototype._set = function (attrName, value) {
      this._data[attrName] = value;
    }

    Class.prototype.get = function (attr) {
      if (!arguments.length) {
        return $.extend({}, this._data);
      }

      var i, attrName, attributes = [], data = {};

      for (i = 0; i < arguments.length; i++) {
        attrName = arguments[i];
        //console.log(attrName, typeof(attrName), Class.attributes);
        if (typeof(attrName) != 'string' || Class.attributes.indexOf(attrName) == -1) {
          throw new ModelError('P01', "Get method should be provided valid attribute names only");
        }
        attributes.push(attrName);
      }

      if (attributes.length == 1) {
        return this._data[ attributes[0] ];
      } else {
        for (i = 0; i < attributes.length; i++) {
          attrName = attributes[i];
          data[ attrName ] = this._data[ attrName ];
        }
        return data;
      }
    };

    Class.prototype.set = function (attrName, value) {
      if (typeof(attrName) != 'string' || Class.attributes.indexOf(attrName) == -1 || arguments.length != 2) {
        throw new ModelError('P02', "Set method should be provided two argument and first of them should be a valid string attribute name");
      }
      this._set(attrName, value);
    };

    Model.classes[name] = Class;

    return Class;
  }

  Model._validators = {};

  Model._parseAttributeNotation = function (attrNotation) {
    var attrName, validators = [], matches, i, validatorsRaw;

    if (typeof attrNotation !== 'string') return false;

    matches = attrNotation.match(/^\s*\[([a-zA-Z]+)\]\s*([a-zA-Z\s]*)$/);
    if (!matches) return false;

    attrName = matches[1];
    validatorsRaw = matches[2].split(/\s+/);

    for (i = 0; i < validatorsRaw.length; i++) {
      if (validatorsRaw[i].length  &&  validators.indexOf(validatorsRaw[i]) === -1) {
        validators.push(validatorsRaw[i]);
      }
    }

    return {
      attrName: attrName,
      validators: validators
    };
  };

  Model.registerValidator = function (name, validatorFn) {
    if (typeof name !== 'string'  ||  !name.match(/^[a-zA-Z]+$/)) {
      throw new ModelError('MrV01', '`Model.registerValidator` expects its 1st argument to be a [a-zA-Z]+ string validator name!');
    }

    if (typeof validatorFn !== 'function') {
      throw new ModelError('MrV02', '`Model.registerValidator` expects its 2nd argument to be actual validator function!');
    }

    if (!!Model._validators[name]) {
      throw new ModelError('MrV03', 'validator with that name already exists!');
    }

    Model._validators[name] = validatorFn;
  };

  Model.classes = {};

  Model.errCodes = {};
  Model.errCodes.WRONG_TYPE = 'wrongtype';
  Model.errCodes.NULL = 'null';
  Model.errCodes.EMPTY = 'empty';

  Model.registerValidator('number', function (value) {
    if (typeof(value) !== 'number') return Model.errCodes.WRONG_TYPE;
  });

  Model.registerValidator('string', function (value) {
    if (typeof(value) !== 'string') return Model.errCodes.WRONG_TYPE;
  });

  Model.registerValidator('boolean', function (value) {
    if (typeof(value) !== 'boolean') return Model.errCodes.WRONG_TYPE;
  });

  Model.registerValidator('nonnull', function (value) {
    if (value === null) return Model.errCodes.NULL;
  });

  Model.registerValidator('nonempty', function (value) {
    if (typeof(value) !== 'string') return;
    if (value === '') return Model.errCodes.EMPTY;
  });

  return Model;

})();