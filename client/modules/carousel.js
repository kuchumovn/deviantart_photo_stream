define(['modules/photostream', 'modules/database', 'modules/template'], function (photostream, database, template) {
	var carousel = {
		timers: {
			Carousel_cycle_interval: 5 * 60 * 1000,
			// for testing:
			// Carousel_cycle_interval: 10 * 1000,
			Image_fade_time: 2 * 1000, // sync this value with the stylesheet
			Query_images_interval: 10 * 1000
		},

		index: -1,

		current_image: function() {
			if (this.index < 0 || this.index >= database.images.length) {
				return
			}
			return database.images[this.index]
		},

		query_and_show_images: function() {
			return photostream.refresh_images().then(function() {
				this.cycling = false
				return this.cycle()
			}
			.bind(this))
		},

		cycle: function(options) {
			return this.go_to(this.index + 1, Object.extend({ refresh_on_exhaustion: true }, options))
		},

		go_to: function(to, options) {
			if (this.cycling) {
				return Promise.reject('Already cycling')
			}

			this.cycling = true

			if (this.cycle_timeout) {
				clearTimeout(this.cycle_timeout)
				this.cycle_timeout = null
			}

			this.index = to

			if (this.index < 0) {
				if (database.images.is_empty()) {
					this.index = 0
				}
				else {
					this.index = database.images.length - 1
				}
			}

			if (this.index < 0 || this.index >= database.images.length) {

				if (options.refresh_on_exhaustion) {

					this.index = -1

					return this.query_and_show_images().finally(function() {
						this.cycling = false
					}
					.bind(this))
				}
				else {
					if (database.images.is_empty()) {
						return Promise.resolve()
					}
					this.index = 0
				}
			}

			console.log('Cycling to image #' + this.index)

			return carousel.show_image(database.images[this.index], options).then(function() {

				this.cycle_timeout = this.cycle.bind(this).delayed(this.timers.Carousel_cycle_interval)
				this.cycling = false
			}
			.bind(this))
		},

		previous: function() {
			return this.go_to(this.index - 1, { forced: true })
		},

		next: function() {
			return this.go_to(this.index + 1, { forced: true })
		},

		image_added: function() {
			if (this.index === -1) {
				this.cycle()
			}
		},

		start: function(container) {
			console.log('Start carousel')
			this.container = container

			this.cycle().catch(function() {
				this.cycle.bind(this).delayed(this.timers.Query_images_interval)
			}
			.bind(this))
		},

		skip: function() {
			if (carousel.current_image()) {
				carousel.blacklist_image()
			}
			return carousel.cycle({ forced: true })
		},

		show_image: function(image, options) {
			return new Promise(function (resolve, reject) {
				console.log('Show image', image)

				var loading_image = document.createElement('img')

				loading_image.onload = (function() {

					var current_image = this.container.querySelector('.image:last-child')

					template.render("picture", image).then(function(markup) {

						console.log(markup)

						var new_image = markup

						carousel.container.appendChild(new_image)

						// force css to animate between style class changes
						function finish() {
							var shown_class = (options && options.forced) ? 'shown_animated_fast' : 'shown_animated_slow'

							if (current_image) {
								/* Listen for a transition */
								new_image.addEventListener(whichTransitionEvent(), function() {
									console.log('removing node', current_image)
									current_image.removeNode()
								})
							}
							
							new_image.classList.add(shown_class)

							resolve()
						}

						finish.delayed(0)
					})
				})
				.bind(this)

				loading_image.onerror = function(error) {
					reject(error)
				}

				loading_image.src = image.url
			}
			.bind(this))
		},

		blacklist_image: function() {
			database.blacklist.push(this.current_image().url)
			database.images.remove(this.current_image())
		}
	}

	return carousel
})