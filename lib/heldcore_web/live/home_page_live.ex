defmodule HeldcoreWeb.HomePageLive do
  use HeldcoreWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: "Automation Agency")}
  end

  def render(assigns) do
    ~H"""
    <div class="font-['Geist',sans-serif] w-screen overflow-x-hidden">
      <!-- Slide 1 -->
      <section class="h-screen w-screen flex flex-col items-center justify-start pt-10 md:pt-24 bg-[#fff] relative">
        <!-- Background waves layer -->
        <div id="waves-background" class="absolute inset-0 z-0 pointer-events-none" phx-hook="WavesBackground"></div>

        <div class="w-full md:w-[min(80vw,1000px)] mx-auto px-4 md:px-4 relative z-5">
          <div class="max-w-2xl mx-auto flex flex-col items-center text-center gap-6 md:gap-8">
            <!-- Logo -->
            <div class="flex flex-col items-center">
              <div
                id="logo-coral"
                class="w-40 h-40 md:w-48 md:h-48"
                phx-hook="GrowCoral"
				data-canvas-width="192"
				data-canvas-height="192"
				data-size="0.6"
				data-tapering="0.965"
				data-smoothness="0.7"
				data-weirdness="0.1"
				data-attractor-count="104"
				data-max-abs-angle="1.57"
				data-node-radius="9"
				data-segment-length="7"
				data-segment-scale="0.8"
				data-show-mask="false"
				data-strength="0.23"
				data-branch-shyness="0.5"
				data-fill-mode="true"
				data-source-x="0.5"
				data-source-y="0.95"
				data-gradient-colors='["#da141d","#f5744c"]'
				data-show-skeleton="false"
				data-simplify-tolerance="0"
				data-vector-mask="false"
				data-controls="false"
				data-regen-on-click="true"
				data-texture="true"
				data-texture-strength="0.5"
              >
              </div>
              <div class="text-xl md:text-3xl mt-2 md:mt-3 font-normal tracking-tight text-black">
                HELDCORE
              </div>
            </div>

            <!-- Title -->
            <h1 class="mt-8 md:mt-24 text-4xl md:text-6xl font-bold uppercase text-gray-900 leading-tight z-10 px-4">
              Automation Agency
            </h1>

            <!-- Tagline -->
            <p class="-mt-2 md:-mt-4 text-gray-900 text-lg md:text-xl font-light max-w-xl px-6">
              We help businesses to identify potentials for automation and provide custom-fit solutions to real-world problems.
            </p>

            <!-- CTA -->
            <button
              type="button"
              onclick="document.getElementById('inquiry-dialog').showModal()"
              class="mt-6 md:mt-10 inline-flex items-center bg-gray-900 text-white border-4 border-white px-7 py-3 md:px-9 md:py-4 rounded-xl font-semibold text-base md:text-lg hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Inquiry
            </button>
          </div>
        </div>

        <!-- Inquiry dialog -->
        <dialog
          id="inquiry-dialog"
          class="fixed inset-0 m-auto rounded-2xl p-0 shadow-2xl w-[min(90vw,480px)] max-h-[90vh] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        >
          <form
            method="POST"
            action="https://formsubmit.co/moritzheld87@gmail.com"
            class="p-6 md:p-8 flex flex-col gap-4 font-['Geist',sans-serif]"
          >
            <div class="flex items-center justify-between">
              <h2 class="text-xl md:text-2xl font-bold text-gray-900">Inquiry</h2>
              <button
                type="button"
                onclick="this.closest('dialog').close()"
                class="text-gray-400 hover:text-gray-900 text-2xl leading-none cursor-pointer"
                aria-label="Close"
              >&times;</button>
            </div>

            <!-- FormSubmit config -->
            <input type="hidden" name="_subject" value="New inquiry from heldcore.de" />
            <input type="text" name="_honey" class="hidden" tabindex="-1" autocomplete="off" />

            <label class="flex flex-col gap-1 text-sm">
              <span class="text-gray-700">Name</span>
              <input
                type="text"
                name="name"
                required
                class="border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </label>

            <label class="flex flex-col gap-1 text-sm">
              <span class="text-gray-700">Email</span>
              <input
                type="email"
                name="email"
                required
                class="border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </label>

            <label class="flex flex-col gap-1 text-sm">
              <span class="text-gray-700">Company</span>
              <input
                type="text"
                name="company"
                class="border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </label>

            <label class="flex flex-col gap-1 text-sm">
              <span class="text-gray-700">What would you like to automate?</span>
              <textarea
                name="message"
                rows="4"
                required
                class="border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              ></textarea>
            </label>

            <div class="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onclick="this.closest('dialog').close()"
                class="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="bg-gray-900 text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-gray-800 cursor-pointer"
              >
                Send
              </button>
            </div>
          </form>
        </dialog>

        <!-- Bottom coral images -->
        <div class="absolute bottom-0 left-0 right-0 flex justify-between items-end z-0 pointer-events-none">
          <!-- Mobile: only show left and right corals -->
          <img src={~p"/images/coral_1.png"} alt="Coral 1" class="h-40 md:h-[50vh] object-contain translate-y-12 md:translate-y-20 -translate-x-10 md:-translate-x-20">
          <img src={~p"/images/coral_2.png"} alt="Coral 2" class="hidden md:block md:h-[50vh] object-contain md:translate-y-44 md:-translate-x-40">
          <img src={~p"/images/coral_3.png"} alt="Coral 3" class="h-44 md:h-[60vh] object-contain translate-y-12 md:translate-y-32 translate-x-10 md:-translate-x-20">
		  <div class="corals-grower mx-auto hidden">
		  	<div
                id="coral-1"
                class="w-[260px] h-[500px] -translate-y-[600px]"
                phx-hook="GrowCoral"
				data-canvas-width="256"
				data-canvas-height="458"
				data-size="0.6"
				data-tapering="0.96"
				data-smoothness="0.7"
				data-weirdness="0.1"
				data-attractor-count="104"
				data-max-abs-angle="1.57"
				data-node-radius="10"
				data-segment-length="18"
				data-segment-scale="0.8"
				data-show-mask="true"
				data-strength="0.23"
				data-branch-shyness="0.1"
				data-fill-mode="true"
				data-source-x="0.5"
				data-source-y="0.95"
				data-gradient-colors='["#da141d","#f5744c"]'
				data-show-skeleton="false"
				data-simplify-tolerance="0"
				data-vector-mask="false"
				data-texture="true"
				data-texture-strength="0.5"
				data-controls="false"
              >
              </div>
		  </div>

        </div>

        <!-- Coral growth canvas -->
        <%!-- <div id="coral-growth" phx-hook="CoralGrowth" class="absolute bottom-0 left-0 right-0 h-[60vh] z-15 pointer-events-none"></div> --%>

      </section>

      <!-- White gradient section -->
      <div class="h-[100px] w-screen relative">
        <div class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-10 bg-gradient-to-t from-white to-white/0"></div>
      </div>

      <!-- Second section -->
      <section class="w-screen flex items-center justify-center bg-[#fff] relative py-32 bg-[#fff] z-10">
        <div class="w-full md:w-[min(80vw,1000px)] mx-auto px-4 md:px-4 relative z-5">
          <footer class="text-black">
            <div class="grid md:grid-cols-3 gap-8 mb-8">
              <!-- Company Information -->
              <div>
                <h3 class="font-bold text-lg mb-4">Company</h3>
                <div class="space-y-2 text-sm">
                  <p class="font-semibold">Heldcore GmbH</p>
                  <p>Falkenried 32F</p>
                  <p>20251 Hamburg</p>
                  <p>Germany</p>
                </div>
              </div>

              <!-- Legal Links -->
              <div>
                <h3 class="font-bold text-lg mb-4">Legal</h3>
                <div class="space-y-2 text-sm">
                  <a href="/impressum" class="block hover:underline">Impressum</a>
                  <a href="#" class="block hover:underline">Privacy Policy</a>
                  <a href="#" class="block hover:underline">Terms of Service</a>
                  <a href="#" class="block hover:underline">Cookie Policy</a>
                </div>
              </div>

              <!-- Contact -->
              <div>
                <h3 class="font-bold text-lg mb-4">Contact</h3>
                <div class="space-y-2 text-sm">
                  <a href="mailto:info@heldcore.com" class="block hover:underline">info@heldcore.com</a>
                </div>
              </div>
            </div>

            <!-- Bottom Bar -->
            <div class="border-t border-gray-200 pt-6">
              <div class="flex flex-col md:flex-row justify-between items-center text-xs text-gray-600">
                <p>&copy; 2025 Heldcore GmbH. All rights reserved.</p>
                <div class="flex space-x-4 mt-2 md:mt-0">
                  <span>Handelsregister: HRB 21610</span>
                  <span>USt-IdNr.: DE341234567</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </section>

              <!-- Parallax scroll hook -->
        <div id="parallax-handler" phx-hook="ParallaxHandler" class="hidden"></div>
      </div>
    """
  end
end
