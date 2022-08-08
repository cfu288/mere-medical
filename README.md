# MariMedical

## Getting started

Serve each one on its own:

```
nx serve web
nx serve desktop
nx serve api
```

Build and serve:

```
npx nx build web
docker build -t mari-medical-web .
docker run -d --restart unless-stopped -p 9999:80 mari-medical-web
```

Serve electron app:

```
npx nx run-many --target=serve --projects=desktop,web
```

Push to registry:

```
docker tag mari-medical-web:latest registry.mari.casa/mari-medical-web:latest                                                       git:(main|)
docker push registry.mari.casa/mari-medical-web:latest
```
