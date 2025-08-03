defmodule HeldcoreWeb.HomePageLive do
  use HeldcoreWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: "Automation Agency")}
  end

  def render(assigns) do
    ~H"""
    <div class="font-['Inter',sans-serif] w-screen overflow-x-hidden">
      <!-- Slide 1 -->
      <section class="h-screen w-screen flex items-center justify-center bg-[#fff] relative">
        <!-- Background waves layer -->
        <div id="waves-background" class="absolute inset-0 z-0 pointer-events-none" phx-hook="WavesBackground"></div>

        <div class="w-full md:w-[min(80vw,1000px)] mx-auto px-4 md:px-4 relative z-5">
          <!-- First line: Logo + Agency name -->
          <div class="md:w-[800px] mx-auto flex flex-col md:flex-row items-start md:items-center mb-2 gap-4 md:gap-20">
            <!-- Logo -->
            <div class="flex flex-col md:mt-[50px]">
              <img src={~p"/images/logo.png"} alt="Logo" class="w-12 h-12 md:w-20 md:h-20 object-contain">
              <div class="flex text-lg md:ml-0.5 md:text-sm mt-1 font-black">
                <div>HELD</div>
                <div><span class="text-rose-500">C</span>ORE</div>
              </div>
            </div>
            <!-- Agency name in two lines -->
            <div class="flex mt-10 md:mt-0 gap-4 md:flex-col text-3xl md:text-7xl font-bold text-left flex-grow md:translate-y-[90px] z-10">
              <div class="text-gray-900">Automation</div>
              <div class="text-gray-900 md:text-[#fff]">Agency</div>
            </div>
          </div>

          <!-- Second line: Background image div -->
          <div class="h-96 md:h-full w-full rounded-lg bg-blue-600 md:bg-transparent bg-contain md:bg-cover bg-center bg-no-repeat relative overflow-hidden mt-8 md:mt-0">
            <img src={~p"/images/rectangle.png"} alt="Background" class="hidden md:block w-full h-full object-contain md:object-cover">
            <!-- White waves layer inside rectangle -->
            <div id="rectangle-waves" class="absolute inset-0 z-0 pointer-events-none" phx-hook="RectangleWaves"></div>
            <div class="absolute inset-0 flex items-center justify-start md:justify-center px-8 md:px-40 pb-12 md:pb-26 z-10 pt-10 md:pt-0">
              <div class="flex flex-col items-start md:items-center text-left md:text-center gap-6">
                <!-- Pearl and text container -->
                <div class="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                  <img src={~p"/images/pearl.png"} alt="Pearl" class="w-16 h-16 md:w-24 md:h-24 object-contain flex-shrink-0 md:order-2">
                  <p id="animated-text" class="text-[#fff] text-base md:text-2xl font-light text-left relative" phx-hook="AnimatedText">
                    <span class="inline-block">We
                      <span class="font-black text-yellow-200">help</span>
                    </span>
                    <span class="inline-block">businesses</span>
                    <span class="inline-block">to
                      <span class="font-bold text-cyan-200">identify</span>
                    </span>
                    <span class="inline-block relative">potentials
                      <svg class="absolute -bottom-3 left-0 w-full h-4 pointer-events-none" viewBox="0 0 100 10" preserveAspectRatio="none">
                        <path d="M0,5 Q25,0 50,5 T100,5" stroke="currentColor" stroke-width="2" fill="none" class="text-yellow-300 underline-path"/>
                      </svg>
                    </span>
                    <span class="inline-block">for</span>
                    <span class="inline-block font-extrabold text-lime-300">automation
                      <svg class="inline w-6 h-6 ml-1 -mt-1 shape-sparkle" viewBox="0 0 24 24" fill="currentColor" class="text-yellow-300">
                        <path d="M12 0l1.5 4.5L18 6l-4.5 1.5L12 12l-1.5-4.5L6 6l4.5-1.5z"/>
                      </svg>
                    </span>
                    <span class="inline-block">and</span>
                    <span class="inline-block">provide</span>
                    <span class="inline-block font-bold text-orange-200">custom-fit</span>
                    <span class="inline-block">solutions</span>
                    <span class="inline-block">to</span>
                    <span class="inline-block relative">real-world
                      <span class="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-yellow-300 to-orange-300 rounded-full highlight-bar"></span>
                    </span>
                    <span class="inline-block font-black text-pink-200">problems.</span>
                  </p>
                </div>
                <!-- CTA Button -->
                <a href="mailto:info@heldcore.com?subject=Inquiry&body=Hi%20Heldcore!%20I%20would%20like%20to%20automate%20something%20in%20my%20company:%20__" id="cta-button" class="mt-5 md:mt-10 bg-[#fff] text-black px-8 py-4 md:px-10 md:py-5 rounded-xl font-black text-lg md:text-xl flex items-center gap-3 self-start relative" style="box-shadow: 0 5px 10px -5px rgba(0, 63, 163, 0.5), 0 10px 10px -5px rgba(14, 87, 175, 0.3); text-decoration: none;" phx-hook="CTAButton">
                  <div class="relative">
                    <svg id="main-icon" class="w-12 h-12 md:w-14 md:h-14 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path id="spark-path-1" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"></path>
                      <path id="spark-path-2" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"></path>
                    </svg>
                  </div>
                  <span>Let's Automate!</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom coral images -->
        <div class="absolute bottom-0 left-0 right-0 flex justify-between items-end z-[5] pointer-events-none">
          <div class="corals-container hidden">
            <!-- Mobile: only show left and right corals -->
            <img src={~p"/images/coral_1.png"} alt="Coral 1" class="h-40 md:h-[50vh] object-contain translate-y-12 md:translate-y-20 -translate-x-10 md:-translate-x-20">
            <img src={~p"/images/coral_2.png"} alt="Coral 2" class="hidden md:block md:h-[50vh] object-contain md:translate-y-44 md:-translate-x-40">
            <img src={~p"/images/coral_3.png"} alt="Coral 3" class="h-44 md:h-[60vh] object-contain translate-y-12 md:translate-y-32 translate-x-10 md:-translate-x-20">
          </div>
          <div class="corals-grower" phx-hook="GrowCoral" id="coral-grower">
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
                  <a href="#" class="block hover:underline">Impressum</a>
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
                  <a href="tel:+491736777934" class="block hover:underline">+49 (0) 173 124566777</a>
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
