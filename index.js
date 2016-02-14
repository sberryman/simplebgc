// var SBGC = require('./build/Release/SBGC');
var SBGC = require('./definitions');
var _ = require('lodash');
var SerialPort = require('serialport');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var defaults = {
    port: '/dev/cu.SLAB_USBtoUART',
    baudRate: 115200,
    bufferSize: 150
};
var serialDefaults = {
    cmdId: SBGC.SBGC_CMD_BOARD_INFO
};

var SerialCommand = function (options) {
    // merge options and defaults
    _.defaults(options, serialDefaults);

    // internal properties
    var pos = 0;
    var len = 0;
    var buf = new Buffer(SBGC.SBGC_CMD_MAX_BYTES);

    // internal methods
    /* Check if limit reached after reading data buffer */
    var checkLimit = function () {
        return len === pos;
    };
    var getBytesAvailable = function () {
        return len - pos;
    };
};


var library = function (options) {

    // merge options and defaults
    _.defaults(options, defaults);

    // variables
    var self = this;
    this.SBGC = SBGC;
    this.serialPort = null;
    self.events = new EventEmitter();

    var internals = this.internals = {
        SBGC: SBGC,
        serialPort: null,
        _this: self,
        events: self.events
    };

    // internal methods
    var _init = function() {

        // open the port
        internals.serialPort = new SerialPort.SerialPort(options.port, {
            baudRate: options.baudRate,
            parser: SerialPort.parsers.raw,
            bufferSize: options.bufferSize
        }, false);

        internals.serialPort.on('error', function (err) {

            // re-emit the error
            console.log('Serial Port Error: ', err);
            self.events.emit('error', err);
        });

        internals.serialPort.on('data', function (data) {
            // console.log('Serial Port Data: ', util.inspect(data));

            // read the header!
            var header = {
                character: data.toString('ascii', 0, 1),
                cmdId: data.readUInt8(1),
                size: data.readUInt8(2),
                checksum: data.readUInt8(3)
            };

            // check the validity of the header
            if (!header ||
                !_.isNumber(header.cmdId) ||
                !_.isNumber(header.size) ||
                !_.isNumber(header.checksum)) {
                throw new Error('Invalid payload!');
            }

            // ensure the checksum is accurate
            if (header.cmdId + header.size !== header.checksum) {
                throw new Error('Invalid checksum!');
            }

            // grab the body
            var body = data.slice(4, header.size + 4);
            var bodyChecksum = data.readUInt8(data.length - 1);

            // debug data!
            // console.log('Header: ' + util.inspect(header));
            // console.log('Body: ' + util.inspect(body) + ' (checksum: ' + bodyChecksum + ', length: ' + body.length + ')');

            // do we have it?
            if (!_.isObject(incomingDataParser[header.cmdId])) {
                return incomingDataParser['not-implemented'];
            }

            // guess so!
            return incomingDataParser[header.cmdId].parse(body);
        });
        internals.serialPort.on('close', function (data) {

            // re-emit
            self.events.emit('close');
        });

        process.nextTick(function () {

            internals.serialPort.open(function (err) {

                // do we have an error?
                if (err) {
                    self.events.emit('error', err);
                    return
                }

                // success, connection is open
                self.events.emit('open');
            });

        });
    };

    // parse incoming data
    // create events using an internal event emitter
    // that clients can subscibe to
    // key = cmdId
    // val = {
    //     event: 'string',
    //     parse: function(buffer, options)
    // }
    // will emit event when parsed
    var incomingDataParserDefaultOptions = {
        emit: true
    };
    var incomingDataParser = {
        'not-implemented': {
            event: 'not-implemented',
            parse: function (buffer, pOpts) {
                throw new Error('Not yet implemented...');
            }
        }
    };

    // register our board info parser
    incomingDataParser[SBGC.SBGC_CMD_BOARD_INFO] = {
        event: 'board_info',
        parse: function (buffer, pOpts) {
            // parse the buffer
            var result = {
                boardVersion: buffer.readUInt8(0),
                firmwareVersion: buffer.readUInt16LE(1),
                debugMode: buffer.readUInt8(3),
                boardFeatures: buffer.readUInt16LE(4),
                connectionFlags: buffer.readUInt8(6),
                frwExtraId: buffer.readUInt32LE(7)

                // reserved (7b)
            };

            // emit?
            if (_.isObject(pOpts) && pOpts.emit === true) {
                console.log('SBGC_CMD_BOARD_INFO: ', result);
                this.emit(incomingDataParser[SBGC.SBGC_CMD_BOARD_INFO].event, result);
            }

            // return our result
            return result;
        }
    };

    // register our board info parser (version 3)
    incomingDataParser[SBGC.SBGC_CMD_BOARD_INFO_3] = {
        event: 'board_info_3',
        parse: function (buffer, pOpts) {
            // parse the buffer
            var result = {
                deviceId: buffer.toString('ascii', 0, 9),
                mcuId: buffer.toString('ascii', 10, 12),
                eepromSize: buffer.readUInt32LE(22),
                scriptSlot1Size: buffer.readUInt16LE(26),
                scriptSlot2Size: buffer.readUInt16LE(28),
                scriptSlot3Size: buffer.readUInt16LE(30),
                scriptSlot4Size: buffer.readUInt16LE(32),
                scriptSlot5Size: buffer.readUInt16LE(34)

                // reserved (34b)
            };

            // emit?
            if (_.isObject(pOpts) && pOpts.emit === true) {
                console.log('SBGC_CMD_BOARD_INFO_3: ', result);
                this.emit(incomingDataParser[SBGC.SBGC_CMD_BOARD_INFO_3].event, result);
            }

            // return our result
            return result;
        }
    };

    // receive paramerts for single profile together with general parameters
    incomingDataParser[SBGC.SBGC_CMD_READ_PARAMS_3] = {
        event: 'read_params_3',
        parse: function (buffer, pOpts) {
            
        }
    };

    // read extended set of params
    incomingDataParser[SBGC.SBGC_CMD_READ_PARAMS_EXT] = {
        event: 'read_params_ext',
        parse: function (buffer, pOpts) {
            
        }
    };

    // receive real-time data!
    incomingDataParser[SBGC.SBGC_CMD_REALTIME_DATA_3] = {
        event: 'realtime_data_3',
        parse: function (buffer, pOpts) {
            // apply our defaults
            pOpts = _.defaults(pOpts || {}, incomingDataParserDefaultOptions);

            // parse the buffer
            var result = {
                // raw data from sensors
                roll: {
                    acc: buffer.readInt16LE(0),
                    gyro: buffer.readInt16LE(2)
                },
                pitch: {
                    acc: buffer.readInt16LE(4),
                    gyro: buffer.readInt16LE(6)
                },
                yaw: {
                    acc: buffer.readInt16LE(8),
                    gyro: buffer.readInt16LE(10)
                },


                serialErrorCnt: buffer.readUInt16LE(12),

                // set of bits (0 -- no error)
                systemError: buffer.readUInt16LE(14),

                // specifies the reason of emergency stop
                systemSubError: buffer.readUInt8(16),


                // reserved: null, (3b)


                // rc control channel values (PWM or normalized analog)
                // min: 1000, max: 2000
                rcRoll: buffer.readInt16LE(20),
                rcPitch: buffer.readInt16LE(22),
                rcYaw: buffer.readInt16LE(24),

                // RC command channel value (PWM or normalized analog)
                // min: 1000, max: 2000
                rcCmd: buffer.readInt16LE(26),

                // external FC PWM values. May be zero if their inputs
                // are mapped to RC control or command
                // min: 1000, max: 2000
                extFcRoll: buffer.readInt16LE(28),
                extFcPitch: buffer.readInt16LE(30),

                // camera angels in 14-bit resolution per full furn.
                // units: 0.02197265625 degree
                // min: -32768, max: 32768
                angleRoll: buffer.readInt16LE(32),
                anglePitch: buffer.readInt16LE(34),
                angleYaw: buffer.readInt16LE(36),

                // frame angels detected by the second IMU (if present)
                // in 14-bit resoltion
                // units: 0.02197265625 degree
                // min: -32768, max: 32768
                frameAngleRoll: buffer.readInt16LE(38),
                frameAnglePitch: buffer.readInt16LE(40),
                frameAngleYaw: buffer.readInt16LE(42),

                // RC angels, in 14-bit resolution
                // units: 0.02197265625 degree
                // min: -32768, max: 32768
                rcAngleRoll: buffer.readInt16LE(44),
                rcAnglePitch: buffer.readInt16LE(46),
                rcAngleYaw: buffer.readInt16LE(48),

                // (no description)
                cycleTime: buffer.readUInt16LE(50),

                // number of registered errors on the I2C bus
                i2cErrorCount: buffer.readUInt16LE(52),

                // deprecated
                errorCode: buffer.readUInt8(54)
            };

            // emit?
            if (_.isObject(pOpts) && pOpts.emit === true) {
                console.log('SBGC_CMD_REALTIME_DATA_3: ', result);
                // internals._this.emit(incomingDataParser[SBGC.SBGC_CMD_REALTIME_DATA_4].event, result);
            }

            // return our result
            return result;
        }
    };

    // receive real-time data!
    incomingDataParser[SBGC.SBGC_CMD_REALTIME_DATA_4] = {
        event: 'realtime_data_4',
        parse: function (buffer, pOpts) {
            // apply our defaults
            pOpts = _.defaults(pOpts || {}, incomingDataParserDefaultOptions);

            // first get version 3
            var realTimeData3 = incomingDataParser[SBGC.SBGC_CMD_REALTIME_DATA_3].parse(buffer, { emit: false });

            // parse the extended data
            var realTimeData4 = {
                // batery voltage
                // units: 0.01 volt
                batLevel: buffer.readUInt16LE(55),

                // bit0 set - motors turn ON,
                // bit1..7 - reserved
                otherFlags: buffer.readUInt8(57),

                // current selected IMU
                // IMU_TYPE_MAIN=1
                // IMU_TYPE_FRAME=2
                // board_ver >= 30 only
                curImu: buffer.readUInt8(58),

                // active profile 0..4
                curProfile: buffer.readUInt8(59),

                // 
                motorPowerRoll: buffer.readUInt8(60),
                motorPowerPitch: buffer.readUInt8(61),
                motorPowerYaw: buffer.readUInt8(62),

                // camera angels in 14-bit resolution per full furn.
                // units: 0.02197265625 degree
                // min: -32768, max: 32768
                rotorAngleRoll: buffer.readUInt16LE(63),
                rotorAnglePitch: buffer.readUInt16LE(65),
                rotorAngleYaw: buffer.readUInt16LE(67),

                // 1 reserved byte

                // error in balance (0 - perfect balance, 512 - 100% motor power is required to hold camera)
                balanceErrorRoll: buffer.readUInt16LE(70),
                balanceErrorPitch: buffer.readUInt16LE(72),
                balanceErrorYaw: buffer.readUInt16LE(74),

                // actual current consumption
                // units: mA
                current: buffer.readUInt16LE(76),

                // raw data from magnetometer
                magDataRoll: buffer.readUInt16LE(78),
                magDataPitch: buffer.readUInt16LE(80),
                magDataYaw: buffer.readUInt16LE(82),

                // temperature of imu boards
                // units: celsius
                imuTemperature: buffer.readUInt8(84),
                frameImuTemperature: buffer.readUInt8(85),

                // error between estimated gravity vector and reference vector for currenctly active IMU
                // units: 0.1 degree
                imuGErr: buffer.readUInt8(86),

                // error between estimated heading vector and reference vector for currenctly active IMU
                // units: 0.1 degree
                imgHErr: buffer.readUInt8(87)

                // reserved (36b)
            };

            // combine the results
            var result = {};
            _.assign(result, realTimeData3, realTimeData4);

            // emit?
            if (_.isObject(pOpts) && pOpts.emit === true) {
                console.log('SBGC_CMD_REALTIME_DATA_4: ', result);
                // internals._this.emit(incomingDataParser[SBGC.SBGC_CMD_REALTIME_DATA_4].event, result);
            }

            // return the result
            return result;
        }
    };

    // confirmation of previous command
    incomingDataParser[SBGC.SBGC_CMD_CONFIRM] = {
        event: 'cmd_confirm',
        parse: function (buffer, pOpts) {
            // emit?
            if (_.isObject(pOpts) && pOpts.emit === true) {
                console.log('SBGC_CMD_CONFIRM: ', buffer);
                this.emit(incomingDataParser[SBGC.SBGC_CMD_CONFIRM].event, buffer);
            }

            // return our result
            return buffer;
        }
    };

    // error on executing previous command
    incomingDataParser[SBGC.SBGC_CMD_ERROR] = {
        event: 'cmd_error',
        parse: function (buffer) {
            // parse the buffer
            var result = {
                code: buffer.readUInt8(0),

                data: new Buffer(buffer.length - 1)
            };

            // copy data
            buffer.copy(result.data, 0, 1, 4);

            // emit?
            if (_.isObject(pOpts) && pOpts.emit === true) {
                console.log('SBGC_CMD_ERROR: ', result);
                this.emit(incomingDataParser[SBGC.SBGC_CMD_ERROR].event, result);
            }

            // return our result
            return result;
        }
    };

    // error on executing previous command
    incomingDataParser[SBGC.SBGC_CMD_GET_ANGLES] = {
        event: 'get_angles',
        parse: function (buffer) {
            // parse the buffer
            var result = {
                // raw data from sensors
                roll: {
                    imuAngle: buffer.readInt16LE(0),
                    rcTargetAngle: buffer.readInt16LE(2),
                    rcSpeed: buffer.readInt16LE(4)
                },
                pitch: {
                    imuAngle: buffer.readInt16LE(6),
                    rcTargetAngle: buffer.readInt16LE(8),
                    rcSpeed: buffer.readInt16LE(10)
                },
                yaw: {
                    imuAngle: buffer.readInt16LE(12),
                    rcTargetAngle: buffer.readInt16LE(14),
                    rcSpeed: buffer.readInt16LE(16)
                }
            };

            // emit?
            if (_.isObject(pOpts) && pOpts.emit === true) {
                console.log('SBGC_CMD_GET_ANGLES: ', result);
                this.emit(incomingDataParser[SBGC.SBGC_CMD_GET_ANGLES].event, result);
            }

            // return our result
            return result;
        }
    };

    // error on executing previous command
    incomingDataParser[SBGC.SBGC_CMD_GET_ANGLES_EXT] = {
        event: 'get_angles_ext',
        parse: function (buffer) {
            // parse the buffer
            var result = {
                // raw data from sensors
                roll: {
                    imuAngle: buffer.readInt16LE(0),
                    rcTargetAngle: buffer.readInt16LE(2),
                    rotorAngle: buffer.readInt32LE(4)
                    // reserved (10b)
                },
                pitch: {
                    imuAngle: buffer.readInt16LE(16),
                    rcTargetAngle: buffer.readInt16LE(18),
                    rotorAngle: buffer.readInt32LE(20)
                    // reserved (10b)
                },
                yaw: {
                    imuAngle: buffer.readInt16LE(32),
                    rcTargetAngle: buffer.readInt16LE(34),
                    rotorAngle: buffer.readInt32LE(36)
                    // reserved (10b)
                }
            };

            // emit?
            if (_.isObject(pOpts) && pOpts.emit === true) {
                console.log('SBGC_CMD_GET_ANGLES_EXT: ', result);
                this.emit(incomingDataParser[SBGC.SBGC_CMD_GET_ANGLES_EXT].event, result);
            }

            // return our result
            return result;
        }
    };

    // public methods
    internals.sendCommand = function (cmdId, data, next) {
        // default to a size of 1? (seems to work)
        var size = (typeof data !== 'undefined' && data !== null && data.length) ? data.length || 1 : 1;

        if (size <= (SBGC.SBGC_CMD_MAX_BYTES - SBGC.SBGC_CMD_NON_PAYLOAD_BYTES)) {

            // if (wait || com_obj->getOutEmptySpace() >= size + SBGC_CMD_NON_PAYLOAD_BYTES) {
            // } else {
            //     return SBGC.PARSER_ERROR_BUFFER_IS_FULL;
            // }

            // create our buffer
            var commandBuffer = new Buffer(SBGC.SBGC_CMD_DATA_SIZE);

            // header!
            
            // // protocol-specific start marker SBGC.SBGC_CMD_START_BYTE
            commandBuffer.write(SBGC.SBGC_CMD_START_BYTE, 0, 1, 'ascii');

            // command id
            commandBuffer.writeUInt8(cmdId, 1);

            // data body length
            commandBuffer.writeUInt8(size, 2);

            // header checksum
            commandBuffer.writeUInt8(cmdId + size, 3);

            // init checksum
            var checksum = 0;

            // data!
            if (typeof data !== 'undefined' && data !== null && data.length > 0) {

                // write it!
                for (var i = 0; i < size; i++) {
                    // console.log('Writing byte: %s - test: %s', data[i], parseInt(data[i], 16))

                    // com_obj->writeByte(((uint8_t*)data)[i]);
                    // commandBuffer.writeUInt8(parseInt(data[i], 16), i + 4);
                    // commandBuffer.writeInt16LE(data[i], SBGC.SBGC_CMD_NON_PAYLOAD_BYTES + i)

                    // update the checksum
                    // SerialCommand::update_checksum(checksum, ((uint8_t*)data)[i]);
                    checksum += data[i];
                    // checksum += parseInt(data[i], 16);
                    // (parseInt(c1, 16) + parseInt(c2, 16)).toString(16);
                }

                // does this work?
                data.copy(commandBuffer, SBGC.SBGC_CMD_NON_PAYLOAD_BYTES - 1, 0, data.length)
                // commandBuffer.write(data);

            } else {
                // write somethind useless :) (it is useless to me as of 2016-01-25)
                commandBuffer[4] = 0x01;

                // checksum force?
                checksum = 1;
            }

            // trim the buffer down
            commandBuffer = commandBuffer.slice(0, SBGC.SBGC_CMD_NON_PAYLOAD_BYTES + size);

            // data checksum
            // commandBuffer.writeUInt8(checksum, 4 + size);
            // commandBuffer[5] = 0x01;
            // commandBuffer.writeUInt8(1, 6);
            // console.log('checksum: %s (mod %s)', checksum, checksum % 256)
            commandBuffer.writeUInt8(checksum % 256, commandBuffer.length - 1);

            // send the buffer!
            internals.serialPort.write(commandBuffer, function () {

                internals.serialPort.drain(next || _.noop);
            });

        } else {

            console.log('PARSER_ERROR_WRONG_CMD_SIZE');
            return SBGC.PARSER_ERROR_WRONG_CMD_SIZE;
        }
    };
    internals.rcRoll = function (roll, pitch, yaw) {
        // enforce bounds
        roll = _.clamp(roll, -500, 500);
        pitch = _.clamp(pitch, -500, 500);
        yaw = _.clamp(yaw, -500, 500);

        // console.log('rcRoll - Roll: %s Pitch: %s Yaw: %s', roll, pitch, yaw);

        // create a buffer for our data
        var rcRollBuffer = new Buffer(SBGC.SBGC_API_VIRT_NUM_CHANNELS * 2);

        // clear out the buffer with undefined (special value of -10,000 according to the docs)
        _.times(SBGC.SBGC_API_VIRT_NUM_CHANNELS - 1, function (i) {
            rcRollBuffer.writeInt16LE(-10000, i * 2);
        });

        // min/max = -500/500
        rcRollBuffer.writeInt16LE(roll, 0);
        rcRollBuffer.writeInt16LE(pitch, 2);
        rcRollBuffer.writeInt16LE(yaw, 4);

        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_API_VIRT_CH_CONTROL,
            rcRollBuffer
        );
    };
    internals.servoOut = function (servoTime) {
        // how many servos?
        var servoPins = 8;
        var isServoTimeArray = _.isArray(servoTime);

        // console.log('servoOut - Pulse time: ', a);

        // create a buffer for our data
        var rcServoBuffer = new Buffer(servoPins * 2);

        // clear out the buffer with undefined (special value of -1 anything less than 0 frees up the pin and makes it floating)
        _.times(servoPins - 1, function (i) {
            // do we have a passed value for this pin?
            if (isServoTimeArray && servoTime.length >= i) {
                rcServoBuffer.writeInt16LE(servoTime[i] || -1, i * 2);
            } else {
                // no value
                rcServoBuffer.writeInt16LE(-1, i * 2);
            }
        });

        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_SERVO_OUT,
            rcServoBuffer,
            _.noop
        );
    };
    internals.requestRealTimeData3 = function () {
        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_REALTIME_DATA_3,
            null
        );
    };
    internals.requestRealTimeData4 = function () {
        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_REALTIME_DATA_4,
            null
        );
    };
    internals.triggerPin = function (pinId, state) {
        // create a buffer for our data
        var pinBuffer = new Buffer(2);

        // pin and state
        pinBuffer.writeUInt8(pinId, 0);
        pinBuffer.writeUInt8(state, 1);

        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_TRIGGER_PIN,
            pinBuffer,
            _.noop
        );
    };
    internals.motorsOn = function() {
        internals.sendCommand(SBGC.SBGC_CMD_MOTORS_ON);
    };
    internals.motorsOff = function() {
        internals.sendCommand(SBGC.SBGC_CMD_MOTORS_OFF);
    };
    internals.executeMenu = function(cmdId) {
        // create a buffer for our data
        var menuBuffer = new Buffer(1);

        // pin and state
        menuBuffer.writeUInt8(cmdId, 0);

        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_EXECUTE_MENU,
            menuBuffer,
            _.noop
        );
    };
    internals.readParams = function(profileId) {
        // create a buffer for our data
        var paramsBuffer = new Buffer(1);

        // pin and state
        paramsBuffer.writeUInt8(profileId, 0);

        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_READ_PARAMS,
            paramsBuffer,
            _.noop
        );
    };
    internals.readParams3 = function(profileId) {
        // create a buffer for our data
        var paramsBuffer = new Buffer(1);

        // pin and state
        paramsBuffer.writeUInt8(profileId, 0);

        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_READ_PARAMS_3,
            paramsBuffer,
            _.noop
        );
    };
    internals.readParamsExt = function(profileId) {
        // create a buffer for our data
        var paramsBuffer = new Buffer(1);

        // pin and state
        paramsBuffer.writeUInt8(profileId, 0);

        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_READ_PARAMS_EXT,
            paramsBuffer,
            _.noop
        );
    };

    var parseControlMode = function (mode) {
        // pretty easy
        // SBGC_CONTROL_MODE_NO: 0,
        // SBGC_CONTROL_MODE_SPEED: 1,
        // SBGC_CONTROL_MODE_ANGLE: 2,
        // SBGC_CONTROL_MODE_SPEED_ANGLE: 3,
        // SBGC_CONTROL_MODE_RC: 4,
        // SBGC_CONTROL_MODE_ANGLE_REL_FRAME: 5,
        switch(mode) {
            case 'off':
                return SBGC.SBGC_CONTROL_MODE_NO;
                break;
            case 'speed':
                return SBGC.SBGC_CONTROL_MODE_SPEED;
                break;
            case 'angle':
                return SBGC.SBGC_CONTROL_MODE_ANGLE;
                break;
            case 'speed-angle':
                return SBGC.SBGC_CONTROL_MODE_SPEED_ANGLE;
                break;
            case 'rc':
                return SBGC.SBGC_CONTROL_MODE_RC;
                break;
            case 'angle-rel-frame':
                return SBGC.SBGC_CONTROL_MODE_ANGLE_REL_FRAME;
                break;
            default:
                return SBGC.SBGC_CONTROL_MODE_SPEED;
        }
    };
    internals.control = function (opts) {
        // default options?
        _.defaults(opts, {
            roll: {
                mode: 'speed',
                speed: -1,
                angle: 0
            },
            pitch: {
                mode: 'speed',
                speed: -1,
                angle: 0
            },
            yaw: {
                mode: 'speed',
                speed: -1,
                angle: 0
            },
        });

        // parse our control mode
        opts.roll.mode = parseControlMode(opts.roll.mode);
        opts.pitch.mode = parseControlMode(opts.pitch.mode);
        opts.yaw.mode = parseControlMode(opts.yaw.mode);

        // create a buffer for our data
        var controlBuffer = new Buffer(15);

        // CONTROL_MODE_ROLL – 1u
        controlBuffer.writeUInt8(opts.roll.mode, 0);

        // CONTROL_MODE_PITCH – 1u
        controlBuffer.writeUInt8(opts.pitch.mode, 1);

        // CONTROL_MODE_YAW – 1u
        controlBuffer.writeUInt8(opts.yaw.mode, 2);

        // SPEED_ROLL – 2s
        controlBuffer.writeInt16LE(opts.roll.speed, 3);

        // ANGLE_ROLL – 2s
        controlBuffer.writeInt16LE(opts.roll.angle, 5);

        // SPEED_PITCH – 2s
        controlBuffer.writeInt16LE(opts.pitch.speed, 7);

        // ANGLE_PITCH – 2s
        controlBuffer.writeInt16LE(opts.pitch.angle, 9);

        // SPEED_YAW – 2s
        controlBuffer.writeInt16LE(opts.yaw.speed, 11);

        // ANGLE_YAW – 2s
        controlBuffer.writeInt16LE(opts.yaw.angle, 13);

        // fire away!
        internals.sendCommand(
            SBGC.SBGC_CMD_CONTROL,
            controlBuffer,
            _.noop
        );
    };

    // open that connection!
    _init();

    // return our internals
    return internals;
};

// export it
module.exports = library;
