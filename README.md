# ChatOps

This is a docker-compose file to configure a full stack for chatops, with gitlab, rocketchat and hubot.

Before you run it, please take a look at the enviroment variables inside the docker-compose.yml, and configure it to your needs.

To bring it all up, enter in the directory and run the command:

``` 
docker-compose up -d
```

To stop all services:

```
docker-compose stop
```

Thanks to all the guys that made it possible:
- [https://hub.docker.com/r/rocketchat/hubot-rocketchat](https://hub.docker.com/r/rocketchat/hubot-rocketchat)
- [https://github.com/github/hubot-scripts](https://github.com/github/hubot-scripts)
- [https://gitlab.com/gitlab-org/omnibus-gitlab/](https://gitlab.com/gitlab-org/omnibus-gitlab/)
- [Rocket.Chat Team](https://github.com/RocketChat/Rocket.Chat.Docs/blob/master/3.%20Installation/3.%20Docker%20Containers/Docker%20Compose.md)
