var winston = require("winston");

function getLogger(module) {
    let path = module.filename
            .split("/")
            .slice(-2)
            .join("/"),
        logger = {},
        console = {
            colorize: true,
            level: "debug",
            label: path,
            timestamp: true
        };

    logger.auth = winston.createLogger({
        format: winston.format.json(),
        transports: [new winston.transports.Console(console), new winston.transports.File({ filename: "./logs/auth.log", label: path })]
    }).info;

    logger.error = winston.createLogger({
        format: winston.format.json(),
        transports: [
            new winston.transports.Console(console),
            new winston.transports.File({
                filename: "./logs/error.log",
                colorize: true,
                label: path
            })
        ]
    }).error;

    logger.warn = winston.createLogger({
        format: winston.format.json(),
        transports: [new winston.transports.Console(console)]
    }).warn;

    logger.api_requests = winston.createLogger({
        format: winston.format.json(),
        transports: [
            // new winston.transports.Console(console),
            new winston.transports.File({
                filename: "./logs/api_requests.log",
                label: path,
                timestamp: true,
                colorize: true
            })
        ]
    }).info;

    logger.model = winston.createLogger({
        format: winston.format.json(),
        transports: [
            // new (winston.transports.Console)(console),
            new winston.transports.File({
                filename: "./logs/model.log",
                label: path,
                timestamp: true,
                colorize: true
            })
        ]
    }).info;

    return logger;
}

module.exports = getLogger;
