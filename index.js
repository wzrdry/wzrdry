'use strict';

// Instana Sensor needed to have node functionality in instana
if (process.env.instana) {
  require('instana-nodejs-sensor')();
}

const { graphiqlHapi } = require('apollo-server-hapi');
const { graphqlHapi } = require('apollo-server-hapi');
const { makeExecutableSchema } = require('graphql-tools');
const Promise = require('bluebird');
const Hapi = require('hapi');
const config = require('./config.js');
const Chairo = require('chairo');
const dns = require('dns');
const os = require('os');
const Resolvers = require('graphql-resolver-loader');

config.server.routes.validate = {
  failAction: async (request, h, err) => {
    if (process.env.NODE_ENV !== 'production') {
      throw err;
    }
  }
};
const server = new Hapi.Server(config.server);

const boot = new Date();

// Tag to enable Syntax Highlighting for graphql
global.gql = literals => {
  return literals;
};

function dnsSeed (seneca, options, bases, next) {
  dns.lookup(
    config.baseName,
    {
      all: true,
      family: 4
    },
    (err, addresses) => {
      let bases = [];

      if (err) {
        throw new Error('dns lookup for base node failed');
      }

      if (Array.isArray(addresses)) {
        bases = addresses.map(address => {
          return address.address;
        });
      } else {
        bases.push(addresses);
      }

      next(bases);
    }
  );
}

async function start () {
  if (module.parent) {
    return;
  }

  try {
    await server.start();
    const bootTime = new Date() - boot;
    console.log(`Server running at: ${server.info.uri}, booted in ${bootTime}`);
  } catch (err) {
    console.log(`Error while starting server: ${err.message}`);
  }
}

async function healthCheck (server) {
  return true;
}

async function register () {
  let _config;
  if (process.env.NODE_ENV !== 'test') {
    try {
      await server.register([
        {
          plugin: require('hapi-new-auth-cookie')
        },
        {
          plugin: Chairo
        },
        {
          plugin: require('hapi-graceful-shutdown-plugin'),
          options: {
            sigtermTimeout: 1,
            sigintTimeout: 1
          }
        },
        {
          plugin: require('hapi-alive'),
          options: {
            path: '/health',
            tags: ['health', 'monitor'],
            healthCheck: healthCheck
          }
        }
      ]);

      _config = {
        auto: true,
        discover: {
          rediscover: true,
          custom: {
            active: true,
            find: dnsSeed
          }
        }
      };

      if (process.env.rancher) {
        _config.host = os.networkInterfaces().eth0[0].address;
      }

      if (config.seneca.bases && config.seneca.bases.indexOf(',')) {
        config.seneca.bases = config.seneca.bases.split(',');
      }

      server.auth.strategy('session', 'cookie', config.cookies);
      // server.auth.default('session');
      server.seneca.use('mesh-ng', Object.assign(config.seneca || {}, _config));

      await Promise.promisify(server.seneca.ready)();
      await server.register([
        {
          plugin: graphqlHapi,
          options: {
            path: '/graphql',
            graphqlOptions: request => ({
              schema: makeExecutableSchema({
                typeDefs: require('./lib/graphql/schema.js'),
                resolvers: Resolvers(server, {
                  resolvers: './lib/resolvers/**/*.js'
                })
              }),
              formatError: error => ({
                message: error.message,
                state: error.originalError && error.originalError.state,
                locations: error.locations,
                path: error.path
              }),
              context: {
                isAuthenticated: request.auth.isAuthenticated,
                session: request.auth.credentials
                  ? request.auth.credentials
                  : null,
                request
              }
            }),
            route: {
              cors: true
            }
          }
        },
        {
          plugin: graphiqlHapi,
          options: {
            path: '/graphiql',
            graphiqlOptions: {
              endpointURL: '/graphql'
            }
          }
        },
        {
          plugin: require('hapi-router'),
          options: {
            routes: 'lib/routes/**/*.js'
          }
        },
        require('vision'),
        require('inert')
      ]);

      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  } else {
    return true;
  }
}

if (!module.parent) {
  (async () => {
    if (await register()) start();
  })();
}

module.exports = register;
