# Environments

A place to store configuration variables. No secrets should be stored here, as they are included in the compiled bundle and served to users.

`config.json` is automatically replaced by `config.prod.json` at build time. `config.prod.json` should have values in the form:

```
{
  ...
  "PUBLIC_URL": "$PUBLIC_URL"
}
```

as values of the form `$PUBLIC_URL` are replaced dynamically at runtime by the docker container serving the frontend.
