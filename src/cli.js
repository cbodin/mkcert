#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const mkcert = require('./mkcert');
const pkg = require('../package.json');

async function createCA({ organization, countryCode, state, locality, validity, key, cert }) {
  validity = Number.parseInt(validity, 10);
  if(!validity || validity < 0) return console.error('`--validity` must be at least 1 day.');

  let ca;
  try {
    ca = await mkcert.createCA({ organization, countryCode, state, locality, validityDays: validity });
  } catch (err) {
    return console.error(`Failed to create the certificate. Error: ${err.message}`);
  }

  key = path.resolve(key);
  fs.writeFileSync(key, ca.key);
  console.log(`CA Private Key: ${key}`);

  cert = path.resolve(cert);
  fs.writeFileSync(cert, ca.cert);
  console.log(`CA Certificate: ${cert}`);

  console.log('Please keep the private key in a secure location.');
}

async function createCert({ domains, caKey, caCert, validity, key, cert }) {
  validity = Number.parseInt(validity, 10);
  if(!validity || validity < 0) return console.error('`--validity` must be at least 1 day.');

  domains = domains.split(',').map( str=> str.trim()); // split the comma separated list of addresses
  if(!domains.length) return console.error('`--domains` must be a comma separated list of ip/domains.');

  const ca = {};

  try {
    ca.key = fs.readFileSync(path.resolve(caKey), 'utf-8');
  } catch(err) {
    return console.error(`Unable to read \`${caKey}\`. Please run \`mkcert create-ca\` to create a new certificate authority.`);
  }

  try {
    ca.cert = fs.readFileSync(path.resolve(caCert), 'utf-8');
  } catch(err) {
    return console.error(`Unable to read \`${caCert}\`. Please run \`mkcert create-ca\` to create a new certificate authority.`);
  }

  let tls;
  try {
    tls = await mkcert.createCert({ domains, validityDays: validity, caKey: ca.key, caCert: ca.cert });
  } catch (err) {
    return console.error(`Failed to create the certificate. Error: ${err.message}`);
  }

  key = path.resolve(key);
  fs.writeFileSync(key, tls.key);
  console.log(`Private Key: ${key}`);

  cert = path.resolve(cert);
  fs.writeFileSync(cert, `${tls.cert}\n${ca.cert}`); // create full chain certificate file by combining ca and domain certificate
  console.log(`Certificate: ${cert}`);
}

program
  .command('create-ca')
  .option('--organization [value]', 'Organization name', 'Test CA')
  .option('--country-code [value]', 'Country code', 'US')
  .option('--state [value]', 'State name', 'California')
  .option('--locality [value]', 'Locality address', 'San Francisco')
  .option('--validity [days]', 'Validity in days', '365')
  .option('--key [file]', 'Output key', 'ca.key')
  .option('--cert [file]', 'Output certificate', 'ca.crt')
  .action(async (options)=> {
    await createCA(options);
  });

program
  .command('create-cert')
  .alias('create-certificate')
  .option('--ca-key [file]', 'CA private key', 'ca.key')
  .option('--ca-cert [file]', 'CA certificate', 'ca.crt')
  .option('--validity [days]', 'Validity in days', '365')
  .option('--key [file]', 'Output key', 'cert.key')
  .option('--cert [file]', 'Output certificate', 'cert.crt')
  .option('--domains [values]', 'Comma separated list of domains/ip addresses', 'localhost,127.0.0.1')
  .action(async (options)=> {
    await createCert(options);
  });

(async () => {
  await program
    .version(pkg.version)
    .parseAsync(process.argv);

  if(process.argv.length < 3) program.outputHelp();
})();
