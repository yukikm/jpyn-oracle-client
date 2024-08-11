declare module "process" {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        PRIVATE_KEY: string;
        ORACLE_CONTRACT_ADDRESS: string;
        PROVIDER_URL: string;
        MUFG_API: string;
        MUFG_API_KEY: string;
        API_URL: string;
      }
    }
  }
}
