#!/bin/bash
# Makefile pour les commandes courantes (optionnel)
# Usage: make help

.PHONY: help install setup db seed dev build test deploy clean

help:
	@echo "🚀 Jeezy TV - Commandes essentielles"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install        - npm install"
	@echo "  make setup          - npm install + prisma generate"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate     - npx prisma migrate dev"
	@echo "  make db-reset       - Reset BDD (attention!)"
	@echo "  make db-seed        - Remplir avec données de test"
	@echo "  make db-studio      - Ouvrir Prisma Studio (interface graphique)"
	@echo ""
	@echo "Development:"
	@echo "  make dev            - npm run dev"
	@echo "  make build          - npm run build"
	@echo "  make test           - npm test"
	@echo ""
	@echo "Utilities:"
	@echo "  make gen-secret     - Générer NEXTAUTH_SECRET"
	@echo "  make clean          - Nettoyer (rm .next, node_modules)"

install:
	npm install

setup:
	npm install
	npx prisma generate

db-migrate:
	npx prisma migrate dev

db-reset:
	npx prisma migrate reset

db-seed:
	npx tsx scripts/seed.ts

db-studio:
	npx prisma studio

dev:
	npm run dev

build:
	npm run build

start:
	npm start

test:
	npm test

gen-secret:
	@node -e "console.log('NEXTAUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

clean:
	rm -rf .next node_modules
	npm install
