default:

rebuild:
	docker-compose down && docker-compose up --build -d

psql:
	docker-compose exec db psql -U postgres

test:
	docker build --target dev -t auth-service-dev ./backend/auth-service && docker run --rm auth-service-dev npm run test:dev

