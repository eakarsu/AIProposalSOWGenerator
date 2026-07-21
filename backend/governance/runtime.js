function validateRuntime(env = process.env) {
 const secret=String(env.JWT_SECRET||'');
 if(secret.length<32||/replace|change|example|generate|random.value|secret-key-2024|default.jwt.secret|^secret$/i.test(secret)) throw new Error('JWT_SECRET must be a non-placeholder value of at least 32 characters.');
 const mode=String(env.NODE_ENV||'development');if(!['development','test','production'].includes(mode))throw new Error('NODE_ENV must be development, test, or production.');
 if(mode==='production'){
  if(!env.DATABASE_URL&&(!env.DB_HOST||!env.DB_NAME||!env.DB_USER||!env.DB_PASSWORD))throw new Error('Production database configuration is incomplete.');
  const origins=String(env.CORS_ORIGINS||env.CLIENT_URL||'').split(',').map(v=>v.trim()).filter(Boolean);if(!origins.length||origins.includes('*'))throw new Error('Production CORS origins must be an explicit allowlist.');
  if(env.ALLOW_MOCK_PROVIDERS==='true'||env.ALLOW_DEMO_SEED==='true'||env.ENABLE_LEGACY_SCHEMA_BOOTSTRAP==='true'||env.ENABLE_LEGACY_PROVIDER_ROUTES==='true'||env.ENABLE_UNTRUSTED_EXECUTION==='true')throw new Error('Legacy, demo, or untrusted execution flags are prohibited in production.');
 }
 return true;
}
module.exports={validateRuntime};
