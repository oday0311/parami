App = {
	web3Provider: null,
	contracts: {},
	account: null,
	htlcIntance: null,
	heightSpan: 100,
	swapID: '',
	recipientAddr: '0xCF5bECb7245E2e6eE2E092F0BD63F6Bd79eF19Fe',

	init: async function () {
		return await App.initWeb3();
	},

	initWeb3: async function () {
		// Modern dapp browsers...
		if (window.ethereum) {
			App.web3Provider = window.ethereum;
			try {
				// Request account access
				await window.ethereum.enable();
			} catch (error) {
				// User denied account access...
				console.error("User denied account access")
			}
		}

		// Legacy dapp browsers...
		else if (window.web3) {
			App.web3Provider = window.web3.currentProvider;
		}
		// If no injected web3 instance is detected, fall back to Ganache
		else {
			App.web3Provider = new Web3.providers.HttpProvider('http://localhost:9545');
		}
		web3 = new Web3(App.web3Provider);

		var account = App.getAccountParam();

		if (null == account) {
			console.log("initAccount");
			App.initAccount();
		} else {
			App.account = account;
			console.log("account:" + account);
		}

		return App.initContract();
	},

	initAccount: function () {
		web3.eth.getAccounts(function (error, accounts) {
			App.account = accounts[0];
		});
	},

	initContract: function () {
		$.getJSON('ERC20HTLC.json', function (data) {
			App.contracts.htlcContract = TruffleContract(data);
			App.contracts.htlcContract.setProvider(App.web3Provider);

			App.contracts.htlcContract.deployed().then(function (instance) {
				App.htlcIntance = instance;

				return App.getHTLCStatus();
			});
		});

		$.getJSON('ProTokenMainnet.json', function (data) {
			App.contracts.praContract = TruffleContract(data);
			App.contracts.praContract.setProvider(App.web3Provider);

			App.contracts.praContract.deployed().then(function (instance) {
				App.praIntance = instance;
				return App.getPraStatus();
			});
		});

		return App.bindEvents();
	},

	getHTLCStatus: function () {
		App.htlcIntance.paused().then(function (paused) {
			console.log("is paused:", paused);
			App.paused = paused;
			if (paused) {
				alert('提示合约已经暂停');
			}
		}).catch(function (err) {
			console.log(err.message);
		});

		App.htlcIntance.praContractAddr().then(function (praContractAddr) {
			console.log("praContractAddr:", praContractAddr);
			App.praContractAddr = praContractAddr;
		}).catch(function (err) {
			console.log(err.message);
		});

		App.htlcIntance.owner().then(function (owner) {
			console.log("owner:", owner);
			App.owner = owner;
		}).catch(function (err) {
			console.log(err.message);
		});
	},

	getPraStatus: function () {
		App.praIntance.totalSupply().then(function (totalSupply) {
			console.log("totalSupply:", totalSupply.toString());
			App.totalSupply = totalSupply;
		}).catch(function (err) {
			console.log(err.message);
		});
	},

	bindEvents: function () {
		$("#approve_new").on('click', function () {
			var amount = parseFloat(document.getElementById("input_num").value);
			if (amount < 0.1) {
				alert("amount must >= 0.1");
				return;
			}
			amount = amount * 1000000000000000000;
			App.praIntance.approve(App.contracts.htlcContract.address, amount).then(
				function (result) {
					if (result.receipt.status == 1) {
						console.log("status success!!");
					} else {
						console.log("status fail!!");
					}
				}
			).catch(function (err) {
				console.log(err.message);
			});
		});

		$("#htlc_new").on('click', function () {
			var amount = parseFloat(document.getElementById("input_num").value);
			if (amount < 0.1) {
				alert("amount must >= 0.1");
				return;
			}

			amount = amount * 1000000000000000000;

			var randomNum = document.getElementById("random_num").value;
			var did = document.getElementById("did").value;

			$.get("/getRandomNumberHash?randomNumber=" + randomNum + "&receiver=" + did, function (data) {
				if (data == null || data == "Error" || data.code != 0) {
					alert('提示 http 500 错误');
				}

				var timestamp = data.data.timestamp;
				App.swapID = data.data.swapID;
				var randomNumberHash = data.data.randomNumberHash;

				App.htlcIntance.htlc(randomNumberHash, timestamp, App.heightSpan, App.recipientAddr, amount, amount, did).then(
					function (result) {
						if (result.receipt.status == 1) {
							console.log("status success!!");
						} else {
							console.log("status fail!!");
						}
					}
				).catch(function (err) {
					console.log(err.message);
				});
			});
		});

		$("#claim").on('click', function () {
			var randomNum = document.getElementById("random_num").value;

			App.htlcIntance.claim(App.swapId, randomNum).then(
				function (result) {
					if (result.receipt.status == 1) {
						console.log("status success!!");
					} else {
						console.log("status fail!!");
					}
				}
			).catch(function (err) {
				console.log(err.message);
			});
		});

		$("#refund").on('click', function () {
			App.htlcIntance.refund(App.swapId).then(
				function (result) {
					if (result.receipt.status == 1) {
						console.log("status success!!");
					} else {
						console.log("status fail!!");
					}
				}
			).catch(function (err) {
				console.log(err.message);
			});
		});
	},

	getAccountParam: function () {
		var reg = new RegExp("(^|&)account=([^&]*)(&|$)");
		var r = window.location.search.substr(1).match(reg);
		if (r != null) return unescape(r[2]); return null;
	},

	// calculateRandomNumberHash: function () {
	//     var randomNumber = document.getElementById("random_num").value;
	//     var timestamp = document.getElementById("time_stamp").value;

	//     const timestampHexStr = timestamp.toString(16);
	//     var timestampHexStrFormat = timestampHexStr;

	//     // timestampHexStrFormat should be the hex string of a 32-length byte array.
	//     // Fill 0 if the timestampHexStr length is less than 64
	//     for (var i = 0; i < 16 - timestampHexStr.length; i++) {
	//         timestampHexStrFormat = '0' + timestampHexStrFormat;
	//     }

	//     const timestampBytes = Buffer.from(timestampHexStrFormat, "hex");
	//     const newBuffer = Buffer.concat([Buffer.from(randomNumber.substring(2, 66), "hex"), timestampBytes]);
	//     const hash = crypto.createHash('sha256');
	//     hash.update(newBuffer);
	//     return "0x" + hash.digest('hex');
	// },

	// calculateSwapIds: function () {
	//     // counted by second
	//     const timestamp = Math.floor(Date.now() / 1000);
	// },

};

$(function () {
	$(window).load(function () {
		App.init();
	});
});
