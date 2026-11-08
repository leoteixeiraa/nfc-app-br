# Armazenamento de placas neste dispositivo

## Situação atual

O dashboard e a criação de placas estão disponíveis sem login. A criação publica
o link por meio da API e guarda no navegador os dados necessários ao gerenciamento
da placa. A sincronização de placas e clientes com a conta ainda não está pronta.
O código de integração em desenvolvimento não deve importar registros antigos
sem confirmação nem remover dados antes da confirmação de persistência.

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

## Associação experimental de placas à conta

O backend contém endpoints experimentais de associação e consulta, desativados por
padrão com `app.account-tags.enabled`. A ativação antes da integração completa
pode impedir o gerenciamento pela interface atual. A associação verifica a
credencial de gerenciamento e o titular, sem alterar o link público. A migration
adiciona a referência ao proprietário, sem transferir dados existentes.

Ainda faltam importação e consulta de clientes, identificação confiável da origem
dos registros locais, confirmação contextual para dados antigos, remoção segura
após confirmação, integração do fluxo de sessão e gestão de placas da conta no
frontend, além da validação de ponta a ponta.
