# Armazenamento de placas neste dispositivo

## Situação atual

O dashboard e a criação de placas estão disponíveis sem login. A criação publica
o link por meio da API e guarda no navegador os dados necessários ao gerenciamento
da placa. Após o login, placas publicadas que ainda não pertencem a uma conta são
associadas automaticamente usando a credencial de gerenciamento local; placas da
conta são importadas para o navegador e atualizadas quando necessário.

Os dados de clientes e seus vínculos continuam apenas no navegador e não são
sincronizados com a conta.

`LocalTagsService` mantém os registros em `nfcapp.tags.v1`. Cada placa tem um
identificador persistente, datas e, quando publicada, o link público e uma
credencial de gerenciamento. `LocalClientsService` mantém clientes e vínculos em
`nfcapp.clients.v1`. Esses dados podem incluir informações sensíveis: não devem
ser expostos em logs, URLs, exemplos reais ou arquivos versionados.

Dados inválidos ou indisponíveis são informados ao usuário; o serviço de placas
não sobrescreve registros que não consegue interpretar. Limpar os dados do site,
usar outro perfil do navegador ou perder o dispositivo pode impedir o acesso
às placas que ainda não foram associadas à conta. Não há backup automático de
clientes nem acesso entre dispositivos para esses dados.

## Associação de placas à conta

Os endpoints autenticados de associação e consulta ficam habilitados por padrão.
`APP_ACCOUNT_TAGS_ENABLED=false` pode desativá-los em uma implantação, mas, nesse
caso, a sincronização da interface não estará disponível. A associação verifica a
credencial de gerenciamento e o titular, sem alterar o link público. A migration
adiciona a referência ao proprietário e não transfere placas existentes
automaticamente: elas são associadas após login somente se ainda estiverem neste
navegador e tiverem sua credencial de gerenciamento local.

Clientes e vínculos continuam armazenados apenas neste navegador e não são
sincronizados com a conta. Placas locais sem credencial de gerenciamento não podem
ser associadas automaticamente; elas permanecem locais e são indicadas como
pendentes na interface. Encerrar a sessão não apaga os dados locais.
