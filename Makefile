.PHONY: install dev-backend dev-frontend build run test clean

install:
	pip install -r requirements.txt
		cd frontend && npm install

dev-backend:
	uvicorn sepa_scanner.web:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

run:
	uvicorn sepa_scanner.web:app --host 0.0.0.0 --port 8000

test:
	pytest tests/ -v

clean:
	rm -rf output/cache output/charts output/scan*.csv output/scan*.json output/scan.log frontend/dist

