'use strict';
const {passportBuilder, authenticateStrategies} = require('./strategies');
const jwt = require('jsonwebtoken');
const config = require('./config');
const {userModel, refreshTokenModel, initializeStore} = require(config.modelsPath);

initializeStore();

function buildAuthManager() {
    const passport = passportBuilder();
    const availableProviders = Object.keys(authenticateStrategies);

    function connectUserByMail(profile, provider) {
        if (profile.mail === undefined || profile.mail === null) {
            return undefined;
        }
        return userModel
            .findByMail(profile.mail)
            .then((userByMail) => {
                return userModel.connect(userByMail, provider, profile);
            });
    }

    function validateSocialToken(provider, req, res) {
        return new Promise((resolve, reject) => {
            passport.authenticate(authenticateStrategies[provider], (error, profile) => {
                return (error !== undefined && error !== null) ? reject(error) : resolve(profile);
            })(req, res);
        });
    }

    function authenticate(profile, provider) {
        return userModel
            .findByProfileId(provider, profile.id)
            .then((user) => {
                if (user === undefined || user === null) {
                    return connectUserByMail(profile, provider);
                }
                return user;
            })
            .then((user) => {
                if (user === undefined || user === null) {
                    return userModel.createUser(provider, profile);
                }
                return user;
            });
    }

    function registerMail(id, mail) {
        return userModel.registerMail(id, mail);
    }

    function connect(id, profile, provider) {
        return userModel.connect(id, provider, profile);
    }

    function sign(user) {
        return jwt.sign(user, config.jwt.secret, {
            expiresIn: config.jwt.expires
        });
    }

    function findById(id) {
        return userModel.findById(id);
    }

    function unlink(id, provider) {
        return userModel.unlink(id, provider);
    }

    function createRefreshToken(user) {
        return refreshTokenModel
            .createToken(user._id)
            .then((tokenDocument) => tokenDocument.token);
    }

    function revokeToken(token, user) {
        return refreshTokenModel
            .validateToken(token, user._id)
            .then(() => refreshTokenModel.removeToken(token));
    }

    function refreshToken(token, user) {
        return refreshTokenModel
            .validateToken(token, user._id)
            .then(() => Promise.all([
                sign(user),
                createRefreshToken(user),
                revokeToken(token, user)
            ]));
    }

    return {
        connectUserByMail,
        validateSocialToken,
        authenticate,
        registerMail,
        connect,
        sign,
        findById,
        unlink,
        createRefreshToken,
        revokeToken,
        refreshToken,
        availableProviders
    };
}

module.exports = buildAuthManager;