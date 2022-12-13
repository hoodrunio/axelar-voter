# axelar-voter

### Install Node.js
```
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash - &&\
sudo apt-get install -y nodejs
```

```
git clone https://github.com/testnetrunn/axelar-voter.git
cd axelar-voter
```

### Install deps

```
npm install
```
### Push prisma
```
npx prisma db push
```

Edit env file: `cp .env.sample .env && nano .env`

### Run
```
node index.js
```
