import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // bcrypt est un module natif - l'utiliser seulement en serveur
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        bcrypt: false,
        crypto: false,
        fs: false,
        path: false,
        os: false,
      };
    }
    
    // Marquer les modules natifs comme externes
    config.externals = [...(config.externals || []), 'bcrypt', 'crypto'];
    
    return config;
  },
  experimental: {
    // Activer la gestion correcte des imports côté serveur
    esmExternals: true,
  },
};

export default nextConfig;
