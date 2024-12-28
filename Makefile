start-services:
	- ./docker/scripts/init.sh
stop-services:
	- docker compose down
build:
	- docker build -f ./Dockerfile-prod -t ms-sunshine-container:latest .
start:
	- docker run --name ms-sunshine-container -p 5018:80 -d ms-sunshine-container:latest
exec:
	- docker exec -it ms-sunshine-container /bin/sh
logs:
	- docker logs -f --tail 50 --timestamps ms-sunshine-container
